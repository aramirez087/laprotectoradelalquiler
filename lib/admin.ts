import 'server-only'

import { cedulaNacional, type VerificacionCedula } from '@/lib/cedula'
import { createAdmin } from '@/lib/supabase/admin'
import { requerirRol, historialResenas } from '@/lib/dal'
import { mensajeAcceso, type AccesoConsulta } from '@/lib/acceso-consulta'
import { anioDe, esFecha, hoyCR, mesDe, rangoInclusivo } from '@/lib/periodo'
import { etiquetaMotivo, normalizarCedula, palabrasBusqueda, variantesAcento } from '@/lib/util'
import type { EstadoResena, Rol, VersionResena } from '@/lib/tipos'
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
const PATRON_CORREO_LEGACY = '%@legacy.laprotec'

const SELECT_RESENA = `
  id, anonima, estado, comentario, detalle_verificacion, permite_correccion, version, creado_en,
  persona:personas(id, nombre, nombre2, apellido1, apellido2, identificacion),
  autor:usuarios(id, nombre, email, identificacion)
`

export interface FilaAdminResena {
  id: number
  anonima: boolean
  estado: EstadoResena
  comentario: string | null
  detalle_verificacion: string | null
  permite_correccion: boolean
  version: number
  historial?: VersionResena[]
  creado_en: string
  persona: {
    id: number
    nombre: string
    nombre2: string | null
    apellido1: string
    apellido2: string | null
    identificacion: string
    verificacionCedula?: VerificacionCedula | null
  }
  autor: { id: number; nombre: string; email: string; identificacion: string | null; facebook: string | null; verificacionCedula?: VerificacionCedula | null } | null
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
  actualizado_en: string
  facebook: string | null
  tieneLogin: boolean
  esLegacy: boolean
  puedeConsultar: boolean | null
  registro: string
}

export type FiltroTipoUsuario = 'cuentas' | 'legacy' | 'todos'
export type FiltroEstadoUsuario = 'todos' | 'activas' | 'inactivas'
export type FiltroLoginUsuario = 'todos' | 'creado' | 'pendiente'
export type FiltroRolUsuario = 'todos' | Rol

export interface ResumenUsuariosAdmin {
  cuentas: number
  legacy: number
  activas: number
  inactivas: number
  conLogin: number
  sinLogin: number
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
  autoresLegacy: number
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
    const facebook = String(fila.proveedor_id ?? '').trim()
    if (facebook) mapa.set(fila.usuario_id as number, facebook)
  }
  return mapa
}

type CrudoResena = {
  id: number
  anonima: boolean | null
  estado: EstadoResena
  comentario: string | null
  detalle_verificacion: string | null
  permite_correccion: boolean
  version: number
  creado_en: string
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
    permite_correccion: row.permite_correccion === true,
    version: row.version,
    creado_en: row.creado_en,
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
  const cedulas = [...new Set(filas.flatMap(fila => [fila.persona.identificacion, fila.autor?.identificacion])
    .map(cedulaNacional).filter((cedula): cedula is string => cedula !== null))]
  const [perfiles, verificaciones, versiones] = await Promise.all([
    facebookPorUsuario(db, filas.flatMap(fila => fila.autor ? [fila.autor.id] : [])),
    cedulas.length ? db.from('verificaciones_cedula').select('identificacion, estado, fecha_padron, nombre_tse, consultado_en').in('identificacion', cedulas)
      : Promise.resolve({ data: [], error: null }),
    historialResenas(filas.map(fila => fila.id)),
  ])
  if (verificaciones.error) throw verificaciones.error
  const porCedula = new Map((verificaciones.data as VerificacionCedula[]).map(resultado => [resultado.identificacion, resultado]))
  const verificacionDe = (identificacion: string | null | undefined) => porCedula.get(cedulaNacional(identificacion) ?? '') ?? null
  return {
    filas: filas.map(fila => ({
      ...fila,
      historial: versiones.filter(v => v.resena_id === fila.id),
      persona: { ...fila.persona, verificacionCedula: verificacionDe(fila.persona.identificacion) },
      autor: fila.autor ? { ...fila.autor, facebook: perfiles.get(fila.autor.id) ?? null, verificacionCedula: verificacionDe(fila.autor.identificacion) } : null,
    })),
    total: count ?? 0,
  }
}

async function contar(consulta: PromiseLike<{ count: number | null; error: { message: string } | null }>) {
  const { count, error } = await consulta
  if (error) throw error
  if (typeof count !== 'number') throw new AvisoAdmin('No pudimos verificar los totales del registro.')
  return count
}

export async function resumenAdmin(): Promise<ResumenAdmin> {
  const { db } = await exigirAdmin()
  const hoy = hoyCR()
  const rango = rangoInclusivo(hoy, hoy)
  const resenas = () => db.from('resenas').select('id', { count: 'exact', head: true })

  const [hoyN, revision, rechazadas, publicadas, usuarios, autoresLegacy, denuncias] = await Promise.all([
    contar(resenas().gte('creado_en', rango.inicio).lt('creado_en', rango.fin)),
    contar(resenas().eq('estado', 'borrador')),
    contar(resenas().eq('estado', 'oculta')),
    contar(resenas().eq('estado', 'publicada')),
    contar(db.from('usuarios').select('id', { count: 'exact', head: true }).not('email', 'ilike', PATRON_CORREO_LEGACY)),
    contar(db.from('usuarios').select('id', { count: 'exact', head: true }).ilike('email', PATRON_CORREO_LEGACY)),
    contar(db.from('denuncias').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente')),
  ])

  return { hoy: hoyN, revision, rechazadas, publicadas, usuarios, autoresLegacy, denuncias }
}

export async function decidirResena(input: { id: number; version: number; estado: EstadoResena; nota: string; permiteCorreccion?: boolean }) {
  const { usuario, db } = await exigirAdmin()
  if (!usuario.activo) throw new AvisoAdmin('No puede moderar con la cuenta inactiva.')
  const nota = input.nota.trim()
  const cambios: { estado: EstadoResena; permite_correccion: boolean; detalle_verificacion?: string } = {
    estado: input.estado, permite_correccion: input.estado === 'oculta' && input.permiteCorreccion === true,
  }
  if (cambios.permite_correccion && !nota) throw new AvisoAdmin('Explique qué debe corregir el autor antes de permitir el reenvío.')
  if (nota) cambios.detalle_verificacion = nota

  let consulta = db
    .from('resenas')
    .update(cambios)
    .eq('id', input.id)
    .eq('version', input.version)
  // A rejected review may switch between correction allowed and final rejection.
  if (input.estado !== 'oculta') consulta = consulta.neq('estado', input.estado)
  const { data, error } = await consulta
    .select('id, persona_id, autor:usuarios(email, nombre)')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new AvisoAdmin('La reseña ya no está disponible para esta decisión. Actualice la página y revise su estado.')
  return {
    personaId: data.persona_id as number,
    autor: uno(data.autor as { email: string; nombre: string } | Array<{ email: string; nombre: string }> | null),
  }
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
    'La reseña cambió desde que la abrió. Actualice la página y revise los cambios.',
  ]
  if (error.code === 'P0001' && mensajes.includes(error.message)) return new AvisoAdmin(error.message)
  return error
}

export async function editarResena(input: {
  id: number
  version: number
  identificacion: string
  nombre: string
  nombre2: string
  apellido1: string
  apellido2: string
  comentario: string
  anonima: boolean
}) {
  const { usuario, db } = await exigirAdmin()
  const { data, error } = await db.rpc('admin_editar_resena_versionada', {
    p_admin_id: usuario.id,
    p_version: input.version,
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

async function resumenUsuarios(db: Cliente): Promise<ResumenUsuariosAdmin> {
  const contar = () => db.from('usuarios').select('id', { count: 'exact', head: true })
  const cuentas = () => contar().not('email', 'ilike', PATRON_CORREO_LEGACY)
  const resultados = await Promise.all([
    cuentas(),
    contar().ilike('email', PATRON_CORREO_LEGACY),
    cuentas().eq('activo', true),
    cuentas().eq('activo', false),
    cuentas().not('auth_user_id', 'is', null),
    cuentas().is('auth_user_id', null),
  ])
  for (const resultado of resultados) {
    if (resultado.error) throw resultado.error
    if (typeof resultado.count !== 'number') throw new AvisoAdmin('No pudimos verificar el resumen de usuarios.')
  }
  const [reales, legacy, activas, inactivas, conLogin, sinLogin] = resultados.map((resultado) => resultado.count as number)
  return { cuentas: reales, legacy, activas, inactivas, conLogin, sinLogin }
}

export async function buscarUsuarios(opts: {
  q?: string
  pagina?: number
  tipo?: FiltroTipoUsuario
  estado?: FiltroEstadoUsuario
  login?: FiltroLoginUsuario
  rol?: FiltroRolUsuario
}): Promise<{ filas: FilaAdminUsuario[]; total: number; resumen: ResumenUsuariosAdmin }> {
  const { db } = await exigirAdmin()
  const pagina = Math.max(1, opts.pagina ?? 1)
  const tipo = opts.tipo ?? 'cuentas'
  const estado = opts.estado ?? 'todos'
  const login = opts.login ?? 'todos'
  const q = (opts.q ?? '').trim().replace(/\s+/g, ' ')
  // Escape a literal substring and quote the PostgREST expression independently.
  // ILIKE treats '*' as a '%' alias even inside quotes; imatch avoids that alias.
  const p = JSON.stringify(q.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&'))
  const filtrar = (consulta: ReturnType<ReturnType<Cliente['from']>['select']>) => {
    if (tipo === 'cuentas') consulta = consulta.not('email', 'ilike', PATRON_CORREO_LEGACY)
    else if (tipo === 'legacy') consulta = consulta.ilike('email', PATRON_CORREO_LEGACY)
    if (estado !== 'todos') consulta = consulta.eq('activo', estado === 'activas')
    if (login === 'creado') consulta = consulta.not('auth_user_id', 'is', null)
    else if (login === 'pendiente') consulta = consulta.is('auth_user_id', null)
    if (opts.rol && opts.rol !== 'todos') consulta = consulta.eq('rol', opts.rol)
    if (q) consulta = consulta.or(`nombre.imatch.${p},email.imatch.${p},identificacion.imatch.${p},telefono.imatch.${p}`)
    return consulta
  }
  const consulta = filtrar(db.from('usuarios')
    .select('id, email, nombre, identificacion, telefono, rol, activo, ultimo_acceso, creado_en, actualizado_en, auth_user_id', { count: 'exact' }))

  const desde = (pagina - 1) * POR_PAGINA
  const [{ data, error, count }, resumen] = await Promise.all([
    consulta.order('nombre', { ascending: true }).order('id', { ascending: true }).range(desde, desde + POR_PAGINA - 1),
    resumenUsuarios(db),
  ])
  if (error?.code === 'PGRST103') {
    const conteo = await filtrar(db.from('usuarios').select('id', { count: 'exact', head: true }))
    if (conteo.error) throw conteo.error
    if (typeof conteo.count !== 'number') throw new AvisoAdmin('No pudimos verificar los resultados. Intente de nuevo.')
    return { filas: [], total: conteo.count, resumen }
  }
  if (error) throw error
  if (typeof count !== 'number') throw new AvisoAdmin('No pudimos verificar los resultados. Intente de nuevo.')
  const base = (data ?? []) as Array<Omit<FilaAdminUsuario, 'facebook' | 'registro' | 'tieneLogin' | 'esLegacy' | 'puedeConsultar'> & { auth_user_id: string | null }>
  if (!base.length) return { filas: [], total: count ?? 0, resumen }
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
      const { auth_user_id: authUserId, ...perfil } = fila
      return { ...perfil, facebook: perfiles.get(fila.id) ?? null,
        tieneLogin: Boolean(authUserId),
        esLegacy: fila.email.toLowerCase().endsWith('@legacy.laprotec'),
        puedeConsultar: typeof acceso?.puede_consultar === 'boolean' ? acceso.puede_consultar : null,
        registro: acceso ? mensajeAcceso(acceso) : 'No se pudo verificar el permiso de consulta',
      }
    }),
    total: count ?? 0,
    resumen,
  }
}

export async function actualizarUsuario(input: { id: number; rol: Rol; activo: boolean; versionEsperada: string }) {
  const { usuario, db } = await exigirAdmin()
  const { data, error } = await db.rpc('admin_actualizar_usuario', {
    p_admin_id: usuario.id,
    p_id: input.id,
    p_rol: input.rol,
    p_activo: input.activo,
    p_version_esperada: input.versionEsperada,
  }).single<{ id: number; nombre: string; actualizado_en: string }>()
  const mensajes = [
    'No puede administrar usuarios con esta cuenta.',
    'No encontramos esa cuenta.',
    'Esta cuenta cambió desde que la abrió. Actualice la página y revise los cambios.',
    'Revise los permisos de la cuenta.',
    'El rol histórico de inquilino solo puede conservarse en cuentas existentes.',
    'Para conceder administración, envíe una invitación de acceso.',
    'No puede quitarse el acceso de administración.',
    'Debe quedar al menos una cuenta de administración activa.',
  ]
  if (error?.code === 'P0001' && mensajes.includes(error.message)) {
    throw new AvisoAdmin(error.message)
  }
  if (error) throw error
  if (!data) throw new AvisoAdmin('No encontramos esa cuenta.')
  return data
}

export interface CambioUsuarioAdmin {
  id: number
  actor_nombre: string
  usuario_nombre: string
  accion: string
  antes: Record<string, unknown> | null
  despues: Record<string, unknown> | null
  creado_en: string
}

export async function obtenerCuentaAdmin(id: number) {
  const { usuario: actor, db } = await exigirAdmin()
  const { data, error } = await db.from('usuarios')
    .select('id, nombre, email, identificacion, telefono, rol, activo, creado_en, actualizado_en, ultimo_acceso, auth_user_id')
    .eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const [historial, accesos, perfiles] = await Promise.all([
    db.rpc('admin_historial_usuario', { p_admin_id: actor.id, p_usuario_id: id, p_limite: 20 }),
    db.rpc('accesos_consulta', { p_usuario_ids: [id] }),
    facebookPorUsuario(db, [id]),
  ])
  if (historial.error) throw historial.error
  if (accesos.error) throw accesos.error
  const acceso = (accesos.data as AccesoConsulta[] | null)?.[0]
  const { auth_user_id: authUserId, ...perfil } = data
  return {
    ...perfil,
    tieneLogin: Boolean(authUserId),
    esLegacy: String(data.email).toLowerCase().endsWith('@legacy.laprotec'),
    facebook: perfiles.get(id) ?? null,
    puedeConsultar: typeof acceso?.puede_consultar === 'boolean' ? acceso.puede_consultar : null,
    registro: acceso ? mensajeAcceso(acceso) : 'No se pudo verificar el permiso de consulta.',
    historial: (historial.data ?? []) as CambioUsuarioAdmin[],
  } as FilaAdminUsuario & { historial: CambioUsuarioAdmin[] }
}

export async function actualizarDatosUsuario(input: {
  id: number; nombre: string; identificacion: string; telefono: string; versionEsperada: string
}) {
  const { usuario, db } = await exigirAdmin()
  const nombre = input.nombre
  const { data, error } = await db.rpc('admin_actualizar_perfil_usuario', {
    p_admin_id: usuario.id, p_id: input.id, p_nombre: nombre,
    p_identificacion: input.identificacion, p_telefono: input.telefono,
    p_version_esperada: input.versionEsperada,
  }).single<{ id: number; nombre: string; actualizado_en: string }>()
  const mensajes = [
    'No puede administrar usuarios con esta cuenta.', 'No encontramos esa cuenta.',
    'Esta cuenta cambió desde que la abrió. Actualice la página y revise los cambios.',
    'Revise el nombre y el teléfono de la cuenta.',
    'Escriba una cédula de 6 a 12 dígitos, o deje el campo vacío.',
    'Esa cédula ya pertenece a otra cuenta.',
  ]
  if (error?.code === 'P0001' && mensajes.includes(error.message)) throw new AvisoAdmin(error.message)
  if (error) throw error
  if (!data) throw new AvisoAdmin('No encontramos esa cuenta.')
  return data
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
