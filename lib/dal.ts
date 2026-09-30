import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { AccesoConsulta } from '@/lib/acceso-consulta'
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
  Denuncia,
  FichaCompleta,
  FilaResenaCompleta,
  EstadoResena,
  Persona,
  Resena,
  Rol,
  Usuario,
  VistaFicha,
} from '@/lib/tipos'

// ============================================================================
// Sesión / usuario
// ============================================================================

async function sesionAdministracionVigente(supabase: Awaited<ReturnType<typeof createClient>>, authUserId: string, admin: ReturnType<typeof createAdmin>) {
  try {
    const { data, error } = await supabase.auth.getClaims()
    const claims = data?.claims
    const sessionId = claims?.session_id
    if (error || claims?.sub !== authUserId || typeof sessionId !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) return false
    const resultado = admin
      ? await admin.rpc('sesion_administracion_vigente', { p_auth_user_id: authUserId, p_session_id: sessionId })
      : await supabase.rpc('mi_sesion_administracion_vigente')
    return !resultado.error && resultado.data === true
  } catch {
    return false
  }
}

export const obtenerUsuario = cache(async (): Promise<Usuario | null> => {
  if (sinSupabase()) return null
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdmin()
  if (admin) {
    const { data, error } = await admin
      .from('usuarios')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if (error || !data) return null
    if (!(await sesionAdministracionVigente(supabase, user.id, admin))) return null
    // Accepted administrators do not need ordinary Facebook onboarding.
    if (data.rol !== 'admin' && cuentaCreadaConFacebook(user) && !(await altaFacebookLista(user.id))) return null
    return data as Usuario
  }

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, avatar_url, rol, activo, ultimo_acceso, creado_en, actualizado_en')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (error || !data) return null
  if (!(await sesionAdministracionVigente(supabase, user.id, null))) return null
  if (data.rol !== 'admin' && cuentaCreadaConFacebook(user) && !(await altaFacebookLista(user.id))) return null
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

  const facebookMeta = typeof user.user_metadata?.facebook === 'string' ? user.user_metadata.facebook.trim() : ''
  const facebook = normalizarPerfilFacebook(facebookMeta) ?? facebookMeta
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
  return String(data.proveedor_id).trim() || null
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

/** Resume the first-review step after an ordinary account logs back in. */
export async function destinoTrasLogin(authUserId: string, siguiente: string): Promise<string> {
  const db = createAdmin()
  if (!db) return siguiente
  const { data: usuario, error } = await db.from('usuarios').select('id, rol, activo').eq('auth_user_id', authUserId).maybeSingle()
  if (error || !usuario || !usuario.activo) return siguiente
  if (usuario.rol === 'admin') return siguiente === '/registro/resena' ? '/admin' : siguiente
  const { count, error: errorResenas } = await db.from('resenas').select('id', { head: true, count: 'exact' }).eq('autor_id', usuario.id)
  return !errorResenas && count === 0 ? '/registro/resena' : siguiente
}

/** Solo memoiza dentro de la petición; Postgres decide la vigencia con su reloj.
 * Nunca persistir este resultado en cookies, JWT ni cachés entre peticiones.
 */
export const accesoConsulta = cache(async (usuario: Usuario): Promise<AccesoConsulta> => {
  const cerrado: AccesoConsulta = {
    usuario_id: usuario.id, puede_consultar: false, aprobadas: 0, pendientes: 0,
    rechazadas: 0, ultima_aprobacion_en: null, vence_en: null, motivo: 'error',
  }
  if (!usuario.activo) return { ...cerrado, motivo: 'inactiva' }
  if (sinSupabase()) return cerrado
  try {
    const admin = createAdmin()
    const { data, error } = admin
      ? await admin.rpc('accesos_consulta', { p_usuario_ids: [usuario.id] })
      : await (await createClient()).rpc('mi_acceso_consulta')
    const acceso = data?.[0] as AccesoConsulta | undefined
    if (error || acceso?.usuario_id !== usuario.id || typeof acceso.puede_consultar !== 'boolean') return cerrado
    return acceso
  } catch {
    return cerrado
  }
})

/** Una referencia temporal estable por petición para hidratar los contadores. */
export const horaServidor = cache(() => Date.now())

/** Todas las lecturas del registro, incluidos metadatos y acciones, pasan aquí. */
export async function puedeConsultar(usuario: Usuario): Promise<boolean> {
  return (await accesoConsulta(usuario)).puede_consultar
}

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
      'id, identificacion, nombre, nombre2, apellido1, apellido2, foto_url, resenas!inner(id, estado, creado_en)',
      { count: 'exact' },
    )
    .eq('resenas.estado', 'publicada')

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
    creado_en: string
  }
  type FilaPersona = VistaFicha['persona'] & {
    resenas: FilaBusqueda[] | null
  }

  const fichas: VistaFicha[] = ((data ?? []) as FilaPersona[]).map((fila) => {
    const rs = (fila.resenas ?? []).filter((r) => r.estado === 'publicada')
    const fechas = rs.map((r) => r.creado_en).sort()
    const { resenas: _resenas, ...persona } = fila
    void _resenas
    return {
      persona,
      resenas: rs.length,
      ultima: fechas.at(-1) ?? null,
    }
  })

  return { fichas, total: count ?? 0 }
}

/** Único agregado público del registro: no devuelve filas ni datos personales. */
export async function contarResenasPublicadas(): Promise<number | null> {
  try {
    const admin = createAdmin()
    if (!admin) return null
    const { count, error } = await admin
      .from('resenas')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'publicada')
    return error || count === null ? null : count
  } catch {
    return null
  }
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
  const autorIncrustado = admin ? '' : ', autor:usuarios(id, nombre, rol)'
  const { data, error } = await supabase
    .from('personas')
    .select(
      `id, identificacion, nombre, nombre2, apellido1, apellido2, foto_url,
       resenas(
         id, estado, comentario, verificada, anonima, creado_en${autorIncrustado}
       )`,
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const ficha = data as FichaCompleta
  return { ...ficha, resenas: await atribuirAutores(ficha.resenas ?? [], usuario) }
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
  if (!admin) throw new Error('No pudimos enviar la reseña. Falta la configuración de administración.')
  const dbPersona = admin
  const enRevision = yo.rol !== 'admin'
  const dbResena = enRevision ? admin : supabase
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
  if (eResena?.code === '23505' && eResena.message.includes('resenas_autor_persona_unica')) {
    throw new Error('No puede enviar otra reseña sobre esta persona. Ya tiene una; puede verla en su perfil.')
  }
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
    .select('id, autor_id, estado, comentario, detalle_verificacion, creado_en, anonima, autor:usuarios(nombre)')
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
      propia: fila.autor_id === usuario.id,
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
      `id, persona_id, estado, comentario, anonima, detalle_verificacion, creado_en,
       persona:personas(id, nombre, nombre2, apellido1, apellido2)`,
    )
    .eq('autor_id', autorId)
    .order('creado_en', { ascending: false })
  if (error) throw error
  return (data ?? []).map((fila) => {
    const persona = uno(fila.persona)
    if (!persona) throw new Error('No se pudo leer el inquilino de la reseña.')
    return { ...fila, persona }
  }) as Array<
    Pick<Resena, 'id' | 'persona_id' | 'estado' | 'comentario' | 'anonima' | 'detalle_verificacion' | 'creado_en'> & {
      persona: Pick<Persona, 'id' | 'nombre' | 'nombre2' | 'apellido1' | 'apellido2'>
    }
  >
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
