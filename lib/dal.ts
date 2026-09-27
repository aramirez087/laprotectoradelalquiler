import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createAdmin } from '@/lib/supabase/admin'
import { createClient, sinSupabase } from '@/lib/supabase/server'
import { palabrasBusqueda, variantesAcento } from '@/lib/util'
import type {
  Calificacion,
  Denuncia,
  Etiqueta,
  FichaCompleta,
  FilaResenaCompleta,
  FotoResena,
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

  const filtros = [`auth_user_id.eq.${user.id}`]
  if (user.email) filtros.push(`email.eq.${user.email.toLowerCase()}`)
  let { data } = await supabase
    .from('usuarios')
    .select('*')
    .or(filtros.join(','))
    .maybeSingle()

  if (!data) {
    // Self-healing: existe en Auth pero aún no tiene perfil en la BD
    const { data: creado } = await supabase
      .from('usuarios')
      .insert({
        auth_user_id: user.id,
        email: user.email ?? '',
        nombre: (user.user_metadata?.nombre as string) ?? 'Usuario',
        rol: (user.user_metadata?.rol as Rol) ?? 'propietario',
      })
      .select()
      .single()
    data = creado
  } else if (user.email && data.email.toLowerCase() === user.email.toLowerCase() && !data.auth_user_id) {
    // Perfil ya existía (seed o migración) sin estar enlazado: enlazar
    const { data: upd } = await supabase
      .from('usuarios')
      .update({ auth_user_id: user.id })
      .eq('id', data.id)
      .select()
      .maybeSingle()
    if (upd) data = upd
  }
  return data as Usuario
})

/** Requiere sesión; redirige a /login si no hay. */
export async function requireUsuario(): Promise<Usuario> {
  const u = await obtenerUsuario()
  if (!u) redirect('/login')
  return u
}

export async function requerirRol(...roles: Rol[]) {
  const u = await requireUsuario()
  if (!roles.includes(u.rol)) redirect('/')
  return u
}

// ============================================================================
// Fichas (personas reseñadas)
// ============================================================================

export async function buscarFichas(opts: {
  q?: string
  provincia?: string
  pagina?: number
}): Promise<{ fichas: VistaFicha[]; total: number }> {
  const supabase = await createClient()
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
  if (opts.provincia && /^\d+$/.test(opts.provincia)) {
    query = query.eq('provincia_id', Number(opts.provincia))
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
  if (!usuario) return null
  try {
    const supabase = await createClient()
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
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('personas')
    .select(
      `*,
       provincia:provincias(nombre),
       resenas(
         id, estado, tipo, calificacion_id, recomienda, drogas,
         dano_vivienda_id, proceso_judicial_id, tipo_contrato_id,
         tipo_alquiler_id, tiempo_alquiler_id,
         detalle_dano, comentario, verificada, creado_en,
         fecha_inicio_alquiler, fecha_fin_alquiler,
         autor:usuarios(id, nombre, rol),
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
  return enriquecerFicha(data as FichaCompleta)
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
}) {
  const supabase = await createClient()
  const identificacion = input.identificacion.trim().replace(/\s+/g, '')

  // 1) Persona: la ficha existente, o la misma cédula aunque cambie el guion.
  let persona: { id: number } | null = null
  if (input.personaId) {
    const { data, error } = await supabase.from('personas').select('id').eq('id', input.personaId).maybeSingle()
    if (error) throw error
    if (!data) throw new Error('No encontramos a esa persona en el registro.')
    persona = data
  } else {
    const { data: exacta, error: errorExacta } = await supabase
      .from('personas')
      .select('id')
      .eq('identificacion', identificacion)
      .maybeSingle()
    if (errorExacta) throw errorExacta
    persona = exacta

    const digitos = identificacion.replace(/\D/g, '')
    if (!persona && digitos.length >= 6) {
      const patron = `%${digitos.split('').join('%')}%`
      const { data: candidatos, error } = await supabase
        .from('personas')
        .select('id, identificacion')
        .ilike('identificacion', patron)
        .limit(30)
      if (error) throw error
      persona = candidatos?.find((p) => (p.identificacion ?? '').replace(/\D/g, '') === digitos) ?? null
    }
  }

  if (!persona) {
    const { data: nueva, error } = await supabase
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
      const { data: otra, error: errorOtra } = await supabase
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

  // 2) Reseña
  const { data: resena, error: eResena } = await supabase
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
      estado: 'publicada',
    })
    .select('id')
    .single()
  if (eResena) throw eResena

  // 3) Etiquetas
  if (input.etiquetas.length) {
    await supabase
      .from('resena_etiquetas')
      .insert(input.etiquetas.map((etiqueta_id) => ({ resena_id: resena!.id, etiqueta_id })))
  }

  return { resenaId: resena!.id, personaId: persona!.id }
}

export async function listarResenasDe(autorId: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
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
  const supabase = await createClient()
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

// Catálogos y tablas puente no son legibles con el rol de la sesión (RLS sin
// política de lectura). El cliente de servicio solo completa fichas que esa
// sesión ya pudo ver.
async function clienteCatalogo() {
  return createAdmin() ?? (await createClient())
}

async function enriquecerFicha(ficha: FichaCompleta): Promise<FichaCompleta> {
  const admin = createAdmin()
  if (!admin) return ficha
  const catalogo = await obtenerLookups()
  const porId = <T extends { id: number }>(filas: T[]) => new Map(filas.map((f) => [f.id, f]))
  const calificaciones = porId(catalogo.calificaciones)
  const danos = porId(catalogo.danos)
  const procesos = porId(catalogo.procesos)
  const contratos = porId(catalogo.contratos)
  const tipos = porId(catalogo.tiposAlquiler)
  const tiempos = porId(catalogo.tiempos)
  const ids = ficha.resenas.map((r) => r.id)

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

  const resenas: FilaResenaCompleta[] = ficha.resenas.map((r) => {
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

  return { ...ficha, provincia, resenas }
}

export const obtenerLookups = cache(async (): Promise<Lookups> => {
  const supabase = await clienteCatalogo()
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
