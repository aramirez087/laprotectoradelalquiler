import 'server-only'

import { createAdmin } from '@/lib/supabase/admin'
import { requerirRol } from '@/lib/dal'
import { mensajeAcceso, type AccesoConsulta } from '@/lib/acceso-consulta'
import { anioDe, esFecha, hoyCR, mesDe, rangoInclusivo } from '@/lib/periodo'
import { etiquetaMotivo, normalizarCedula, normalizarPerfilFacebook, palabrasBusqueda, variantesAcento } from '@/lib/util'
import type { EstadoResena, Rol } from '@/lib/tipos'
import type { SupabaseClient } from '@supabase/supabase-js'

export class AvisoAdmin extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AvisoAdmin'
  }
}

export class SinClaveAdmin extends AvisoAdmin {
  constructor() {
    super('Falta la clave secreta de Supabase para la administración.')
    this.name = 'SinClaveAdmin'
  }
}

const POR_PAGINA = 20

const SELECT_RESENA = `
  id, anonima, estado, comentario, detalle_verificacion, creado_en, fecha_inicio_alquiler,
  calificacion:calificaciones(valor, texto),
  persona:personas(id, nombre, nombre2, apellido1, apellido2, identificacion),
  autor:usuarios(id, nombre, email, identificacion)
`

export interface FilaAdminResena {
  id: number
  anonima: boolean
  estado: EstadoResena
  comentario: string | null
  detalle_verificacion: string | null
  creado_en: string
  fecha_inicio_alquiler: string | null
  calificacion: { valor: number; texto: string } | null
  persona: {
    id: number
    nombre: string
    nombre2: string | null
    apellido1: string
    apellido2: string | null
    identificacion: string
  }
  autor: { id: number; nombre: string; email: string; identificacion: string | null; facebook: string | null } | null
}

export interface FilaAdminUsuario {
  id: number
  email: string
  nombre: string
  identificacion: string | null
  telefono: string | null
  rol: Rol
  activo: boolean
  ultimo_acceso: string | null
  creado_en: string
  facebook: string | null
}

export interface FilaConteo {
  id: number
  nombre: string
  email: string
  rol: Rol
  activo: boolean
  total: number
  publicadas: number
  revision: number
  rechazadas: number
}

export interface FilaDenuncia {
  id: number
  motivo: string
  detalle: string | null
  creado_en: string
  denunciante: string
  resenaId: number
  personaId: number | null
  persona: string
  comentario: string | null
}

export interface ResumenAdmin {
  hoy: number
  revision: number
  rechazadas: number
  publicadas: number
  usuarios: number
  denuncias: number
}

type Cliente = SupabaseClient

function uno<T>(valor: T | T[] | null | undefined): T | null {
  if (!valor) return null
  return Array.isArray(valor) ? (valor[0] ?? null) : valor
}

async function exigirAdmin() {
  const usuario = await requerirRol('admin')
  const db = createAdmin()
  if (!db) throw new SinClaveAdmin()
  return { usuario, db }
}

function textoPlano(q: string) {
  return q.replace(/[%_,()]/g, ' ').replace(/\s+/g, ' ').trim()
}

function patron(valor: string) {
  return `"%${valor.replace(/"/g, '')}%"`
}

async function facebookPorUsuario(db: Cliente, ids: number[]) {
  const mapa = new Map<number, string>()
  const unicos = [...new Set(ids)]
  if (!unicos.length) return mapa
  const { data, error } = await db
    .from('autenticaciones')
    .select('usuario_id, proveedor_id')
    .eq('proveedor', 'facebook')
    .in('usuario_id', unicos)
  if (error) throw error
  for (const fila of data ?? []) {
    const url = normalizarPerfilFacebook(String(fila.proveedor_id ?? ''))
    if (url) mapa.set(fila.usuario_id as number, url)
  }
  return mapa
}

type CrudoResena = {
  id: number
  anonima: boolean | null
  estado: EstadoResena
  comentario: string | null
  detalle_verificacion: string | null
  creado_en: string
  fecha_inicio_alquiler: string | null
  calificacion: FilaAdminResena['calificacion'] | NonNullable<FilaAdminResena['calificacion']>[] | null
  persona: FilaAdminResena['persona'] | FilaAdminResena['persona'][] | null
  autor: FilaAdminResena['autor'] | NonNullable<FilaAdminResena['autor']>[] | null
}

function aFila(row: CrudoResena): FilaAdminResena | null {
  const persona = uno(row.persona)
  if (!persona) return null
  return {
    id: row.id,
    anonima: row.anonima === true,
    estado: row.estado,
    comentario: row.comentario,
    detalle_verificacion: row.detalle_verificacion,
    creado_en: row.creado_en,
    fecha_inicio_alquiler: row.fecha_inicio_alquiler,
    calificacion: uno(row.calificacion),
    persona,
    autor: (() => {
      const autor = uno(row.autor)
      return autor ? { ...autor, facebook: null } : null
    })(),
  }
}

async function idsPersona(db: Cliente, q: string) {
  const palabras = palabrasBusqueda(q)
  if (!palabras.length) return []
  let consulta = db.from('personas').select('id')
  for (const palabra of palabras) {
    const filtros = variantesAcento(palabra).flatMap((v) => {
      const p = patron(v)
      return [
        `nombre.ilike.${p}`,
        `nombre2.ilike.${p}`,
        `apellido1.ilike.${p}`,
        `apellido2.ilike.${p}`,
        `identificacion.ilike.${p}`,
      ]
    })
    consulta = consulta.or(filtros.join(','))
  }
  const { data, error } = await consulta.limit(40)
  if (error) throw error
  return (data ?? []).map((p) => p.id as number)
}

export async function consultarResenas(opts: {
  q?: string
  estado?: EstadoResena | ''
  autorId?: number
  desde?: string
  hasta?: string
  pagina?: number
  limite?: number
}) {
  const { db } = await exigirAdmin()
  const pagina = Math.max(1, opts.pagina ?? 1)
  const limite = opts.limite ?? POR_PAGINA
  let consulta = db.from('resenas').select(SELECT_RESENA, { count: 'exact' })

  if (opts.estado) consulta = consulta.eq('estado', opts.estado)
  if (opts.autorId) consulta = consulta.eq('autor_id', opts.autorId)
  if (opts.desde && opts.hasta && esFecha(opts.desde) && esFecha(opts.hasta) && opts.desde <= opts.hasta) {
    const rango = rangoInclusivo(opts.desde, opts.hasta)
    consulta = consulta.gte('creado_en', rango.inicio).lt('creado_en', rango.fin)
  }

  const q = (opts.q ?? '').trim()
  if (q) {
    const ids = await idsPersona(db, q)
    const comentario = textoPlano(q)
    const partes: string[] = []
    if (ids.length) partes.push(`persona_id.in.(${ids.join(',')})`)
    if (comentario.length >= 2) partes.push(`comentario.ilike.${patron(comentario)}`)
    if (!partes.length) return { filas: [] as FilaAdminResena[], total: 0 }
    consulta = consulta.or(partes.join(','))
  }

  const desdeFila = (pagina - 1) * limite
  const { data, error, count } = await consulta
    .order('creado_en', { ascending: false })
    .range(desdeFila, desdeFila + limite - 1)
  if (error) throw error

  const filas = ((data ?? []) as CrudoResena[]).flatMap((row) => {
    const fila = aFila(row)
    return fila ? [fila] : []
  })
  const perfiles = await facebookPorUsuario(
    db,
    filas.flatMap((fila) => (fila.autor ? [fila.autor.id] : [])),
  )
  return {
    filas: filas.map((fila) =>
      fila.autor ? { ...fila, autor: { ...fila.autor, facebook: perfiles.get(fila.autor.id) ?? null } } : fila,
    ),
    total: count ?? 0,
  }
}

async function contar(consulta: PromiseLike<{ count: number | null; error: { message: string } | null }>) {
  const { count, error } = await consulta
  if (error) throw error
  return count ?? 0
}

export async function resumenAdmin(): Promise<ResumenAdmin> {
  const { db } = await exigirAdmin()
  const hoy = hoyCR()
  const rango = rangoInclusivo(hoy, hoy)
  const resenas = () => db.from('resenas').select('id', { count: 'exact', head: true })

  const [hoyN, revision, rechazadas, publicadas, usuarios, denuncias] = await Promise.all([
    contar(resenas().gte('creado_en', rango.inicio).lt('creado_en', rango.fin)),
    contar(resenas().eq('estado', 'borrador')),
    contar(resenas().eq('estado', 'oculta')),
    contar(resenas().eq('estado', 'publicada')),
    contar(db.from('usuarios').select('id', { count: 'exact', head: true })),
    contar(db.from('denuncias').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente')),
  ])

  return { hoy: hoyN, revision, rechazadas, publicadas, usuarios, denuncias }
}

export async function decidirResena(input: { id: number; estado: EstadoResena; nota: string }) {
  const { usuario, db } = await exigirAdmin()
  if (!usuario.activo) throw new AvisoAdmin('No puede moderar con la cuenta inactiva.')
  const nota = input.nota.trim()
  const cambios: { estado: EstadoResena; detalle_verificacion?: string } = { estado: input.estado }
  if (nota) cambios.detalle_verificacion = nota

  const { data, error } = await db
    .from('resenas')
    .update(cambios)
    .eq('id', input.id)
    .select('id, persona_id')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new AvisoAdmin('No encontramos esa reseña.')
  return data.persona_id as number
}

type ResultadoCambioResena = {
  persona_id: number
  persona_anterior_id?: number
  movida?: boolean
  autor_email: string
  autor_nombre: string
}

function errorCambioResena(error: { code?: string; message: string }) {
  if (error.code === '23505' && error.message.includes('resenas_autor_persona_unica')) {
    return new AvisoAdmin('Ese propietario ya tiene una reseña sobre la persona de destino.')
  }
  if (error.code === '23505') return new AvisoAdmin('Esa cédula ya identifica a otro inquilino.')
  const mensajes = [
    'No puede administrar reseñas con esta cuenta.',
    'No encontramos esa reseña.',
    'Escriba un documento de 6 a 12 dígitos; puede incluir guiones.',
    'Revise los campos indicados.',
  ]
  if (error.code === 'P0001' && mensajes.includes(error.message)) return new AvisoAdmin(error.message)
  return error
}

export async function editarResena(input: {
  id: number
  identificacion: string
  nombre: string
  nombre2: string
  apellido1: string
  apellido2: string
  comentario: string
  anonima: boolean
}) {
  const { usuario, db } = await exigirAdmin()
  const { data, error } = await db.rpc('admin_editar_resena', {
    p_admin_id: usuario.id,
    p_id: input.id,
    p_identificacion: normalizarCedula(input.identificacion),
    p_nombre: input.nombre,
    p_nombre2: input.nombre2,
    p_apellido1: input.apellido1,
    p_apellido2: input.apellido2,
    p_comentario: input.comentario,
    p_anonima: input.anonima,
  }).single<ResultadoCambioResena>()
  if (error) throw errorCambioResena(error)
  if (!data) throw new AvisoAdmin('No encontramos esa reseña.')
  return {
    personaId: data.persona_id,
    personaAnteriorId: data.persona_anterior_id,
    movida: data.movida,
    autor: { email: data.autor_email, nombre: data.autor_nombre },
  }
}

export async function eliminarResena(id: number) {
  const { usuario, db } = await exigirAdmin()
  const { data, error } = await db.rpc('admin_eliminar_resena', {
    p_admin_id: usuario.id,
    p_id: id,
  }).single<ResultadoCambioResena>()
  if (error) throw errorCambioResena(error)
  if (!data) throw new AvisoAdmin('No encontramos esa reseña.')
  return { personaId: data.persona_id, autor: { email: data.autor_email, nombre: data.autor_nombre } }
}

export async function conteoPorUsuario(q: string) {
  const { db } = await exigirAdmin()
  const totales = new Map<number, { total: number; publicadas: number; revision: number; rechazadas: number }>()
  const tam = 1000

  for (let desde = 0; desde < 20000; desde += tam) {
    const { data, error } = await db
      .from('resenas')
      .select('autor_id, estado')
      .order('id', { ascending: true })
      .range(desde, desde + tam - 1)
    if (error) throw error
    for (const fila of data ?? []) {
      const id = fila.autor_id as number
      const actual = totales.get(id) ?? { total: 0, publicadas: 0, revision: 0, rechazadas: 0 }
      actual.total += 1
      if (fila.estado === 'publicada') actual.publicadas += 1
      else if (fila.estado === 'borrador') actual.revision += 1
      else if (fila.estado === 'oculta') actual.rechazadas += 1
      totales.set(id, actual)
    }
    if (!data || data.length < tam) break
  }

  const ids = [...totales.keys()]
  const usuarios: Array<{ id: number; nombre: string; email: string; rol: Rol; activo: boolean }> = []
  for (let i = 0; i < ids.length; i += 200) {
    const lote = ids.slice(i, i + 200)
    const { data, error } = await db.from('usuarios').select('id, nombre, email, rol, activo').in('id', lote)
    if (error) throw error
    usuarios.push(...((data ?? []) as typeof usuarios))
  }

  const needle = textoPlano(q).toLowerCase()
  const filas: FilaConteo[] = usuarios
    .map((u) => {
      const n = totales.get(u.id)
      if (!n) return null
      return { ...u, ...n }
    })
    .filter((f): f is FilaConteo => {
      if (!f) return false
      if (!needle) return true
      return `${f.nombre} ${f.email}`.toLowerCase().includes(needle)
    })
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es'))

  return filas
}

export async function buscarUsuarios(opts: { q?: string; pagina?: number }) {
  const { db } = await exigirAdmin()
  const pagina = Math.max(1, opts.pagina ?? 1)
  let consulta = db
    .from('usuarios')
    .select('id, email, nombre, identificacion, telefono, rol, activo, ultimo_acceso, creado_en', { count: 'exact' })

  const q = textoPlano(opts.q ?? '')
  if (q.length >= 2) {
    const p = patron(q)
    consulta = consulta.or(
      `nombre.ilike.${p},email.ilike.${p},identificacion.ilike.${p},telefono.ilike.${p}`,
    )
  }

  const desde = (pagina - 1) * POR_PAGINA
  const { data, error, count } = await consulta.order('nombre', { ascending: true }).range(desde, desde + POR_PAGINA - 1)
  if (error) throw error
  const base = (data ?? []) as Array<Omit<FilaAdminUsuario, 'facebook' | 'registro'>>
  const ids = base.map((fila) => fila.id)
  const [perfiles, resultadoAccesos] = await Promise.all([
    facebookPorUsuario(db, ids),
    db.rpc('accesos_consulta', { p_usuario_ids: ids }),
  ])
  if (resultadoAccesos.error) throw resultadoAccesos.error
  const accesos = new Map((resultadoAccesos.data as AccesoConsulta[] ?? []).map((a) => [a.usuario_id, a]))
  return {
    filas: base.map((fila) => {
      const acceso = accesos.get(fila.id)
      return { ...fila, facebook: perfiles.get(fila.id) ?? null,
        registro: acceso ? mensajeAcceso(acceso) : 'No se pudo verificar el permiso de consulta',
      }
    }),
    total: count ?? 0,
  }
}

export async function actualizarUsuario(input: { id: number; rol: Rol; activo: boolean }) {
  const { usuario, db } = await exigirAdmin()
  if (!usuario.activo) throw new AvisoAdmin('No puede editar cuentas con la suya inactiva.')
  if (input.id === usuario.id && (input.rol !== 'admin' || !input.activo)) {
    throw new AvisoAdmin('No puede quitarse el acceso de administración.')
  }
  const { data, error } = await db
    .from('usuarios')
    .update({ rol: input.rol, activo: input.activo, actualizado_en: new Date().toISOString() })
    .eq('id', input.id)
    .select('id')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new AvisoAdmin('No encontramos esa cuenta.')
}

export async function listarDenunciasPendientes(): Promise<FilaDenuncia[]> {
  const { db } = await exigirAdmin()
  const { data, error } = await db
    .from('denuncias')
    .select(
      `id, motivo, detalle, creado_en,
       denunciante:usuarios(nombre),
       resena:resenas(id, comentario, persona:personas(id, nombre, nombre2, apellido1, apellido2))`,
    )
    .eq('estado', 'pendiente')
    .order('creado_en', { ascending: true })
    .limit(50)
  if (error) throw error

  return ((data ?? []) as Array<Record<string, unknown>>).flatMap((row) => {
    const resena = uno(row.resena as { id: number; comentario: string | null; persona: FilaAdminResena['persona'] | FilaAdminResena['persona'][] | null } | null)
    const denunciante = uno(row.denunciante as { nombre: string } | Array<{ nombre: string }> | null)
    const persona = resena ? uno(resena.persona) : null
    if (!resena) return []
    return [
      {
        id: row.id as number,
        motivo: row.motivo as string,
        detalle: (row.detalle as string | null) ?? null,
        creado_en: row.creado_en as string,
        denunciante: denunciante?.nombre ?? 'Usuario',
        resenaId: resena.id,
        personaId: persona?.id ?? null,
        persona: persona
          ? [persona.nombre, persona.nombre2, persona.apellido1, persona.apellido2].filter(Boolean).join(' ')
          : 'Persona',
        comentario: resena.comentario,
      },
    ]
  })
}

export async function resolverDenuncia(input: { id: number; aceptar: boolean }) {
  const { usuario, db } = await exigirAdmin()
  if (!usuario.activo) throw new AvisoAdmin('No puede moderar con la cuenta inactiva.')
  const { data: denuncia, error: errorDenuncia } = await db
    .from('denuncias')
    .select('id, resena_id, motivo, estado')
    .eq('id', input.id)
    .maybeSingle()
  if (errorDenuncia) throw errorDenuncia
  if (!denuncia || denuncia.estado !== 'pendiente') throw new AvisoAdmin('Esa denuncia ya estaba resuelta.')

  const { data: resena, error: errorResena } = await db
    .from('resenas')
    .select('id, detalle_verificacion, persona_id')
    .eq('id', denuncia.resena_id)
    .maybeSingle()
  if (errorResena) throw errorResena

  if (input.aceptar && resena) {
    const cambios: { estado: 'oculta'; detalle_verificacion?: string } = { estado: 'oculta' }
    if (!resena.detalle_verificacion) {
      cambios.detalle_verificacion = `Denuncia aceptada: ${etiquetaMotivo(String(denuncia.motivo))}`
    }
    const { error } = await db.from('resenas').update(cambios).eq('id', resena.id)
    if (error) throw error
  }

  const { error } = await db
    .from('denuncias')
    .update({
      estado: input.aceptar ? 'aceptada' : 'rechazada',
      resuelta_en: new Date().toISOString(),
    })
    .eq('id', input.id)
    .eq('estado', 'pendiente')
  if (error) throw error
  return (resena?.persona_id as number | undefined) ?? null
}

export function periodoPorDefecto(desdeRaw: string, hastaRaw: string) {
  const hoy = hoyCR()
  const desde = esFecha(desdeRaw) ? desdeRaw : hoy
  const hasta = esFecha(hastaRaw) ? hastaRaw : hoy
  if (desde <= hasta) return { desde, hasta }
  return { desde: hasta, hasta: desde }
}

export function atajosPeriodo() {
  const hoy = hoyCR()
  return {
    hoy: { desde: hoy, hasta: hoy },
    mes: mesDe(hoy),
    anio: anioDe(hoy),
  }
}

export const TAMANO_PAGINA_ADMIN = POR_PAGINA
