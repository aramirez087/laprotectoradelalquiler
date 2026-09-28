import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { altaFacebookLista, altaFacebookPendiente } from '@/lib/facebook-alta'
import { cuentaCreadaConFacebook, rutaAltaFacebook } from '@/lib/facebook-auth'
import { createAdmin } from '@/lib/supabase/admin'
import { createClient, sinSupabase } from '@/lib/supabase/server'
import {
  destinoInterno,
  esCedulaValida,
  normalizarCedula,
  normalizarPerfilFacebook,
  palabrasBusqueda,
  variantesAcento,
} from '@/lib/util'
import type {
  Calificacion,
  Denuncia,
  Etiqueta,
  FichaCompleta,
  FilaResenaCompleta,
  FotoResena,
  EstadoResena,
  Lookups,
  NombreId,
  Persona,
  Resena,
  Rol,
  Usuario,
  VistaFicha,
} from '@/lib/tipos'

// ============================================================================
// Sesión / usuario
// ============================================================================

export const obtenerUsuario = cache(async (): Promise<Usuario | null> => {
  if (sinSupabase()) return null
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  // Una cuenta nueva de Facebook elige cédula y rol en /registro/facebook.
  if (cuentaCreadaConFacebook(user) && !(await altaFacebookLista(user.id))) return null

  const admin = createAdmin()
  if (admin) {
    const { data, error } = await admin
      .from('usuarios')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if (error || !data) return null
    return data as Usuario
  }

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, avatar_url, rol, activo, ultimo_acceso, creado_en, actualizado_en')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (error || !data) return null
  return {
    ...data,
    email: user.email ?? '',
    identificacion: null,
    telefono: null,
    auth_user_id: user.id,
    persona_id: null,
  } as Usuario
})

/** Completa cédula y Facebook si el alta los guardó en la sesión y faltan en el perfil. */
export async function completarPerfilRegistro(usuario: Usuario) {
  const admin = createAdmin()
  if (!admin) return usuario
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return usuario

  let actual = usuario
  const cedulaMeta =
    typeof user.user_metadata?.identificacion === 'string' ? normalizarCedula(user.user_metadata.identificacion) : ''
  if (!actual.identificacion && esCedulaValida(cedulaMeta)) {
    const { data } = await admin
      .from('usuarios')
      .update({ identificacion: cedulaMeta })
      .eq('id', actual.id)
      .select('*')
      .maybeSingle()
    if (data) actual = data as Usuario
  }

  const facebook =
    typeof user.user_metadata?.facebook === 'string' ? normalizarPerfilFacebook(user.user_metadata.facebook) : null
  if (facebook) {
    const { data: ya } = await admin
      .from('autenticaciones')
      .select('id')
      .eq('usuario_id', actual.id)
      .eq('proveedor', 'facebook')
      .maybeSingle()
    if (!ya) {
      await admin.from('autenticaciones').insert({
        usuario_id: actual.id,
        proveedor: 'facebook',
        proveedor_id: facebook,
      })
    }
  }
  return actual
}

export async function perfilFacebookDe(usuarioId: number) {
  const admin = createAdmin()
  if (!admin) return null
  const { data, error } = await admin
    .from('autenticaciones')
    .select('proveedor_id')
    .eq('usuario_id', usuarioId)
    .eq('proveedor', 'facebook')
    .maybeSingle()
  if (error || !data?.proveedor_id) return null
  return normalizarPerfilFacebook(String(data.proveedor_id))
}

/** Requiere sesión; redirige a /login si no hay. */
export async function requireUsuario(siguiente = '/fichas'): Promise<Usuario> {
  const u = await obtenerUsuario()
  const destino = destinoInterno(siguiente)
  if (!u) {
    if (await altaFacebookPendiente()) redirect(rutaAltaFacebook(destino))
    redirect(`/login?${new URLSearchParams({ siguiente: destino })}`)
  }
  return u
}

export async function requerirRol(...roles: Rol[]) {
  const u = await requireUsuario()
  if (!u.activo || !roles.includes(u.rol)) redirect('/')
  return u
}

/**
 * Consultar el registro (buscar fichas y leer reseñas ajenas) exige al menos
 * una reseña propia ya publicada. Administración entra siempre.
 * Si la consulta falla, se niega el acceso.
 */
export const puedeConsultar = cache(async (usuario: Usuario): Promise<boolean> => {
  if (usuario.rol === 'admin') return true
  if (sinSupabase()) return false
  const admin = createAdmin()
  const supabase = admin ?? (await createClient())
  const { count, error } = await supabase
    .from('resenas')
    .select('id', { count: 'exact', head: true })
    .eq('autor_id', usuario.id)
    .eq('estado', 'publicada')
  if (error) return false
  return (count ?? 0) > 0
})

export type MotivoEspera = 'ninguna' | 'revision' | 'rechazada'

/** Por qué alguien aún no consulta: no ha escrito, está en revisión, o solo tiene rechazos. */
export const motivoEspera = cache(async (usuario: Usuario): Promise<MotivoEspera> => {
  const admin = createAdmin()
  if (!admin) return 'ninguna'
  const { data, error } = await admin.from('resenas').select('estado').eq('autor_id', usuario.id)
  if (error || !data?.length) return 'ninguna'
  const estados = data.map((fila) => String(fila.estado))
  if (estados.includes('borrador')) return 'revision'
  if (estados.includes('oculta')) return 'rechazada'
  return 'ninguna'
})

// ============================================================================
// Fichas (personas reseñadas)
// ============================================================================

export async function buscarFichas(opts: {
  q?: string
  pagina?: number
}): Promise<{ fichas: VistaFicha[]; total: number }> {
  const usuario = await obtenerUsuario()
  if (!usuario || !(await puedeConsultar(usuario))) return { fichas: [], total: 0 }

  const supabase = await clienteServicio()
  const porPagina = 20
  const pagina = Math.max(1, Number.isFinite(opts.pagina) ? Math.floor(opts.pagina ?? 1) : 1)

  let query = supabase
    .from('personas')
    .select(
      '*, provincia:provincias(nombre), resenas(id, estado, calificacion_id, calificacion:calificaciones(valor), creado_en)',
      { count: 'exact' },
    )

  for (const palabra of palabrasBusqueda(opts.q ?? '')) {
    const filtros = variantesAcento(palabra).flatMap((v) => [
      `nombre.ilike.%${v}%`,
      `nombre2.ilike.%${v}%`,
      `apellido1.ilike.%${v}%`,
      `apellido2.ilike.%${v}%`,
      `identificacion.ilike.%${v}%`,
    ])
    query = query.or(filtros.join(','))
  }

  const { data, count, error } = await query
    .order('apellido1', { ascending: true })
    .order('nombre', { ascending: true })
    .range((pagina - 1) * porPagina, pagina * porPagina - 1)
  if (error) throw error

  type FilaBusqueda = {
    estado: string
    calificacion_id: number | null
    calificacion: { valor: number } | null
    creado_en: string
  }
  type FilaPersona = Persona & {
    provincia: { nombre: string } | null
    resenas: FilaBusqueda[] | null
  }

  const catalogo = await obtenerLookups().catch(() => null)
  const valorPorId = new Map((catalogo?.calificaciones ?? []).map((c) => [c.id, c.valor]))
  const provinciaPorId = new Map((catalogo?.provincias ?? []).map((p) => [p.id, p.nombre]))

  const fichas: VistaFicha[] = ((data ?? []) as FilaPersona[]).map((fila) => {
    const rs = (fila.resenas ?? []).filter((r) => r.estado === 'publicada')
    const valores = rs.flatMap((r) => {
      const valor = r.calificacion?.valor ?? (r.calificacion_id ? valorPorId.get(r.calificacion_id) : undefined)
      return valor ? [valor] : []
    })
    const fechas = rs.map((r) => r.creado_en).sort()
    const { provincia, resenas: _resenas, ...persona } = fila
    void _resenas
    return {
      persona,
      provincia: provincia?.nombre ?? (fila.provincia_id ? provinciaPorId.get(fila.provincia_id) ?? null : null),
      resenas: rs.length,
      promedio: valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null,
      ultima: fechas.at(-1) ?? null,
    }
  })

  return { fichas, total: count ?? 0 }
}

export async function resumenRegistro(): Promise<{ personas: number; resenas: number } | null> {
  if (sinSupabase()) return null
  const usuario = await obtenerUsuario()
  if (!usuario || !(await puedeConsultar(usuario))) return null
  try {
    const supabase = await clienteServicio()
    const [personas, resenas] = await Promise.all([
      supabase.from('personas').select('id', { count: 'exact', head: true }),
      supabase.from('resenas').select('id', { count: 'exact', head: true }).eq('estado', 'publicada'),
    ])
    if (personas.error || resenas.error) return null
    return { personas: personas.count ?? 0, resenas: resenas.count ?? 0 }
  } catch {
    return null
  }
}

export const obtenerFicha = cache(async (id: number): Promise<FichaCompleta | null> => {
  const usuario = await obtenerUsuario()
  if (!usuario || !(await puedeConsultar(usuario))) return null

  const supabase = await clienteServicio()
  const admin = createAdmin()
  // autor_id no es legible por la sesión. Con clave de servicio se resuelve
  // después y se omite si la reseña es anónima para quien no administra.
  const autorIncrustado = admin ? '' : '\n         autor:usuarios(id, nombre, rol),'
  const { data, error } = await supabase
    .from('personas')
    .select(
      `*,
       provincia:provincias(nombre),
       resenas(
         id, estado, tipo, calificacion_id, recomienda, drogas,
         dano_vivienda_id, proceso_judicial_id, tipo_contrato_id,
         tipo_alquiler_id, tiempo_alquiler_id,
         detalle_dano, comentario, verificada, anonima, creado_en,
         fecha_inicio_alquiler, fecha_fin_alquiler,${autorIncrustado}
         calificacion:calificaciones(valor, texto),
         dano:danos_vivienda(nombre),
         proceso:procesos_judiciales(nombre),
         contrato:tipos_contrato(nombre),
         tipoAlquiler:tipos_alquiler(nombre),
         tiempo:tiempos_alquiler(nombre),
         etiquetas:resena_etiquetas(etiqueta:etiquetas(nombre)),
         conductas:resena_conductas(conducta:conductas(nombre)),
         fotos:fotos_resena(id, resena_id, url, descripcion, orden)
       )`,
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return enriquecerFicha(data as FichaCompleta, usuario)
})

// ============================================================================
// Reseñas
// ============================================================================

export async function crearResena(input: {
  personaId?: number | null
  identificacion: string
  nombre: string
  nombre2?: string
  apellido1: string
  apellido2?: string
  provinciaId?: number | null
  calificacionId?: number | null
  recomienda?: boolean | null
  drogas?: boolean | null
  danoId?: number | null
  detalleDano?: string | null
  procesoId?: number | null
  contratoId?: number | null
  tipoAlquilerId?: number | null
  tiempoId?: number | null
  fechaInicio?: string | null
  fechaFin?: string | null
  comentario?: string | null
  etiquetas: number[]
  autorId: number
  anonima?: boolean
}) {
  const yo = await requireUsuario()
  if (yo.id !== input.autorId) throw new Error('No puede publicar a nombre de otra cuenta.')
  if (!yo.activo) throw new Error('Su cuenta está inactiva y no puede publicar.')

  const supabase = await createClient()
  const admin = createAdmin()
  const dbPersona = admin ?? supabase
  const enRevision = yo.rol !== 'admin'
  if (enRevision && !admin) {
    throw new Error('No pudimos enviar la reseña a revisión. Falta la configuración de administración.')
  }
  const dbResena = enRevision ? admin! : supabase
  const identificacion = input.identificacion.trim().replace(/\s+/g, '')

  // 1) Persona: la ficha existente, o la misma cédula aunque cambie el guion.
  let persona: { id: number } | null = null
  if (input.personaId) {
    const { data, error } = await dbPersona.from('personas').select('id').eq('id', input.personaId).maybeSingle()
    if (error) throw error
    if (!data) throw new Error('No encontramos a esa persona en el registro.')
    persona = data
  } else {
    const { data: exacta, error: errorExacta } = await dbPersona
      .from('personas')
      .select('id')
      .eq('identificacion', identificacion)
      .maybeSingle()
    if (errorExacta) throw errorExacta
    persona = exacta

    const digitos = identificacion.replace(/\D/g, '')
    if (!persona && digitos.length >= 6) {
      const patron = `%${digitos.split('').join('%')}%`
      const { data: candidatos, error } = await dbPersona
        .from('personas')
        .select('id, identificacion')
        .ilike('identificacion', patron)
        .limit(30)
      if (error) throw error
      persona = candidatos?.find((p) => (p.identificacion ?? '').replace(/\D/g, '') === digitos) ?? null
    }
  }

  if (!persona) {
    const { data: nueva, error } = await dbPersona
      .from('personas')
      .insert({
        identificacion,
        nombre: input.nombre,
        nombre2: input.nombre2 ?? null,
        apellido1: input.apellido1,
        apellido2: input.apellido2 ?? null,
        provincia_id: input.provinciaId ?? null,
      })
      .select('id')
      .single()
    if (error?.code === '23505') {
      const { data: otra, error: errorOtra } = await dbPersona
        .from('personas')
        .select('id')
        .eq('identificacion', identificacion)
        .maybeSingle()
      if (errorOtra) throw errorOtra
      if (!otra) throw error
      persona = otra
    } else if (error) {
      throw error
    } else {
      persona = nueva
    }
  }

  // 2) Reseña. Quien no administra queda en revisión. El cliente de
  // servicio hace falta porque la política de lectura oculta los borradores
  // y un INSERT ... RETURNING no devolvería el id.
  const { data: resena, error: eResena } = await dbResena
    .from('resenas')
    .insert({
      persona_id: persona!.id,
      autor_id: input.autorId,
      calificacion_id: input.calificacionId ?? null,
      recomienda: input.recomienda ?? null,
      drogas: input.drogas ?? null,
      dano_vivienda_id: input.danoId ?? null,
      detalle_dano: input.detalleDano || null,
      proceso_judicial_id: input.procesoId ?? null,
      tipo_contrato_id: input.contratoId ?? null,
      tipo_alquiler_id: input.tipoAlquilerId ?? null,
      tiempo_alquiler_id: input.tiempoId ?? null,
      fecha_inicio_alquiler: input.fechaInicio || null,
      fecha_fin_alquiler: input.fechaFin || null,
      comentario: input.comentario || null,
      anonima: input.anonima === true,
      estado: enRevision ? 'borrador' : 'publicada',
    })
    .select('id')
    .single()
  if (eResena) throw eResena

  // 3) Etiquetas
  if (input.etiquetas.length) {
    const { error: errorEtiquetas } = await dbResena
      .from('resena_etiquetas')
      .insert(input.etiquetas.map((etiqueta_id) => ({ resena_id: resena!.id, etiqueta_id })))
    if (errorEtiquetas) throw errorEtiquetas
  }

  return { resenaId: resena!.id, personaId: persona!.id, enRevision }
}

export async function resenasPrivadasVisibles(personaId: number, usuario: Usuario) {
  const admin = createAdmin()
  if (!admin) return []
  let consulta = admin
    .from('resenas')
    .select('id, estado, comentario, detalle_verificacion, creado_en, anonima, autor:usuarios(nombre)')
    .eq('persona_id', personaId)
    .neq('estado', 'publicada')
    .order('creado_en', { ascending: false })
    .limit(20)
  if (usuario.rol !== 'admin') consulta = consulta.eq('autor_id', usuario.id)
  const { data, error } = await consulta
  if (error) throw error
  return (data ?? []).map((fila) => {
    const autor = uno(fila.autor as { nombre: string } | Array<{ nombre: string }> | null)
    return {
      id: fila.id as number,
      estado: fila.estado as EstadoResena,
      comentario: (fila.comentario as string | null) ?? null,
      detalle_verificacion: (fila.detalle_verificacion as string | null) ?? null,
      creado_en: fila.creado_en as string,
      anonima: fila.anonima === true,
      autor: usuario.rol === 'admin' ? autor?.nombre ?? null : null,
    }
  })
}

export async function listarResenasDe(autorId: number) {
  const yo = await requireUsuario()
  const admin = createAdmin()
  const db = admin && (yo.id === autorId || yo.rol === 'admin') ? admin : await createClient()
  const { data, error } = await db
    .from('resenas')
    .select(
      `*, persona:personas(id, nombre, nombre2, apellido1, apellido2),
       calificacion:calificaciones(valor, texto)`,
    )
    .eq('autor_id', autorId)
    .order('creado_en', { ascending: false })
  if (error) throw error
  return data as Array<Resena & { persona: Persona; calificacion: Calificacion | null }>
}

export async function denunciarResena(input: {
  resenaId: number
  denuncianteId: number
  motivo: Denuncia['motivo']
  detalle: string
}) {
  const supabase = await createClient()
  const { error } = await supabase.from('denuncias').insert({
    resena_id: input.resenaId,
    denunciante_id: input.denuncianteId,
    motivo: input.motivo,
    detalle: input.detalle,
  })
  if (error) throw error
}

export async function buscarPersonasParaResena(q: string) {
  const usuario = await obtenerUsuario()
  if (!usuario || !(await puedeConsultar(usuario))) return []
  const supabase = await clienteServicio()
  const { data } = await supabase
    .from('personas')
    .select('id, nombre, nombre2, apellido1, apellido2, identificacion')
    .or(`nombre.ilike.%${q}%,apellido1.ilike.%${q}%`)
    .limit(8)
  return data
}

function uno<T>(valor: T | T[] | null | undefined): T | null {
  if (!valor) return null
  return Array.isArray(valor) ? valor[0] ?? null : valor
}

// La cédula, los borradores y las tablas privadas solo los lee el servicio,
// después de autorizar en el servidor. El cliente de la sesión es el respaldo.
async function clienteServicio() {
  return createAdmin() ?? (await createClient())
}

async function atribuirAutores(resenas: FilaResenaCompleta[], usuario: Usuario): Promise<FilaResenaCompleta[]> {
  const admin = createAdmin()
  const ids = resenas.map((r) => r.id)
  const vinculos = new Map<number, { autorId: number; anonima: boolean }>()
  const autores = new Map<number, { id: number; nombre: string; rol: Rol }>()

  if (admin && ids.length) {
    const { data, error } = await admin.from('resenas').select('id, autor_id, anonima').in('id', ids)
    if (error) throw error
    for (const fila of data ?? []) {
      vinculos.set(fila.id as number, { autorId: fila.autor_id as number, anonima: fila.anonima === true })
    }
    const autorIds = [...new Set([...vinculos.values()].map((v) => v.autorId))]
    if (autorIds.length) {
      const { data: cuentas, error: errorCuentas } = await admin
        .from('usuarios')
        .select('id, nombre, rol')
        .in('id', autorIds)
      if (errorCuentas) throw errorCuentas
      for (const cuenta of cuentas ?? []) {
        autores.set(cuenta.id as number, {
          id: cuenta.id as number,
          nombre: String(cuenta.nombre),
          rol: cuenta.rol as Rol,
        })
      }
    }
  }

  return resenas.map((r) => {
    const vinculo = vinculos.get(r.id)
    const anonima = vinculo?.anonima ?? r.anonima === true
    const autorId = vinculo?.autorId ?? r.autor?.id ?? null
    const autor = autorId != null ? autores.get(autorId) ?? r.autor : r.autor
    const propia = autorId === usuario.id
    const visible = !anonima || usuario.rol === 'admin'
    return { ...r, anonima, propia, autor: visible ? autor ?? null : null }
  })
}

async function enriquecerFicha(ficha: FichaCompleta, usuario: Usuario): Promise<FichaCompleta> {
  const admin = createAdmin()
  if (!admin) return { ...ficha, resenas: await atribuirAutores(ficha.resenas ?? [], usuario) }
  const catalogo = await obtenerLookups()
  const porId = <T extends { id: number }>(filas: T[]) => new Map(filas.map((f) => [f.id, f]))
  const calificaciones = porId(catalogo.calificaciones)
  const danos = porId(catalogo.danos)
  const procesos = porId(catalogo.procesos)
  const contratos = porId(catalogo.contratos)
  const tipos = porId(catalogo.tiposAlquiler)
  const tiempos = porId(catalogo.tiempos)
  const existentes = ficha.resenas ?? []
  const ids = existentes.map((r) => r.id)

  let etiquetas: Array<{ resena_id: number; etiqueta: Etiqueta | Etiqueta[] | null }> = []
  let conductas: Array<{ resena_id: number; conducta: { nombre: string } | Array<{ nombre: string }> | null }> = []
  let fotos: FotoResena[] = []
  if (ids.length) {
    const [etq, cond, fot] = await Promise.all([
      admin.from('resena_etiquetas').select('resena_id, etiqueta:etiquetas(id, nombre, tipo)').in('resena_id', ids),
      admin.from('resena_conductas').select('resena_id, conducta:conductas(nombre)').in('resena_id', ids),
      admin.from('fotos_resena').select('id, resena_id, url, descripcion, orden').in('resena_id', ids),
    ])
    if (etq.error) throw etq.error
    if (cond.error) throw cond.error
    if (fot.error) throw fot.error
    etiquetas = (etq.data ?? []) as typeof etiquetas
    conductas = (cond.data ?? []) as typeof conductas
    fotos = (fot.data ?? []) as FotoResena[]
  }

  const provincia = ficha.provincia?.nombre
    ? ficha.provincia
    : catalogo.provincias.find((p) => p.id === ficha.provincia_id) ?? null

  const resenas: FilaResenaCompleta[] = existentes.map((r) => {
    const etiquetasResena = etiquetas
      .filter((e) => e.resena_id === r.id)
      .flatMap((e) => {
        const etiqueta = uno(e.etiqueta)
        return etiqueta ? [{ etiqueta }] : []
      })
    const conductasResena = conductas
      .filter((c) => c.resena_id === r.id)
      .flatMap((c) => {
        const conducta = uno(c.conducta)
        return conducta ? [{ conducta }] : []
      })
    return {
      ...r,
      calificacion: r.calificacion ?? (r.calificacion_id ? calificaciones.get(r.calificacion_id) ?? null : null),
      dano: r.dano ?? (r.dano_vivienda_id ? danos.get(r.dano_vivienda_id) ?? null : null),
      proceso: r.proceso ?? (r.proceso_judicial_id ? procesos.get(r.proceso_judicial_id) ?? null : null),
      contrato: r.contrato ?? (r.tipo_contrato_id ? contratos.get(r.tipo_contrato_id) ?? null : null),
      tipoAlquiler: r.tipoAlquiler ?? (r.tipo_alquiler_id ? tipos.get(r.tipo_alquiler_id) ?? null : null),
      tiempo: r.tiempo ?? (r.tiempo_alquiler_id ? tiempos.get(r.tiempo_alquiler_id) ?? null : null),
      etiquetas: etiquetasResena.length ? etiquetasResena : r.etiquetas ?? [],
      conductas: conductasResena.length ? conductasResena : r.conductas ?? [],
      fotos: fotos.some((f) => f.resena_id === r.id) ? fotos.filter((f) => f.resena_id === r.id) : r.fotos ?? [],
    }
  })

  return { ...ficha, provincia, resenas: await atribuirAutores(resenas, usuario) }
}

export const obtenerLookups = cache(async (): Promise<Lookups> => {
  const supabase = await clienteServicio()
  const [calif, etq, danos, procesos, contratos, tiposAlq, tiempos, provincias] =
    await Promise.all([
      supabase.from('calificaciones').select('*').order('valor'),
      supabase.from('etiquetas').select('*').eq('tipo', 'inquilino').order('nombre'),
      supabase.from('danos_vivienda').select('*').order('id'),
      supabase.from('procesos_judiciales').select('*').order('id'),
      supabase.from('tipos_contrato').select('*').order('id'),
      supabase.from('tipos_alquiler').select('*').order('id'),
      supabase.from('tiempos_alquiler').select('*').order('id'),
      supabase.from('provincias').select('*').order('nombre'),
    ])
  const err = [calif, etq, danos, procesos, contratos, tiposAlq, tiempos, provincias].find((r) => r.error)
  if (err) throw err.error!
  return {
    calificaciones: (calif.data ?? []) as Lookups['calificaciones'],
    etiquetas: (etq.data ?? []) as Lookups['etiquetas'],
    danos: (danos.data ?? []) as NombreId[],
    procesos: (procesos.data ?? []) as NombreId[],
    contratos: (contratos.data ?? []) as NombreId[],
    tiposAlquiler: (tiposAlq.data ?? []) as NombreId[],
    tiempos: (tiempos.data ?? []) as NombreId[],
    provincias: (provincias.data ?? []) as NombreId[],
  }
})
