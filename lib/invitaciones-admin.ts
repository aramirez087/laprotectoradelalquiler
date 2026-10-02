import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import * as z from 'zod'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { requerirRol } from '@/lib/dal'
import { requiereSegundoFactor, rutaSegundoFactor } from '@/lib/dos-factores'
import { createAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { correoResenasConfigurado, enviarCorreo } from '@/lib/correo-resenas'
import { AvisoAdmin, SinClaveAdmin } from '@/lib/admin'

export type PropositoInvitacion = 'administracion' | 'acceso'
export type EstadoInvitacion = 'pendiente' | 'aceptada' | 'vencida' | 'revocada'
export interface FilaInvitacionAdmin {
  id: string
  email: string
  nombre: string
  invitado_por: number | null
  invitador_nombre: string | null
  creado_en: string
  vence_en: string
  aceptada_en: string | null
  revocada_en: string | null
  enviada_en: string | null
  error_envio_en: string | null
  target_usuario_id: number | null
  proposito: PropositoInvitacion
  estado: EstadoInvitacion
}

interface CuentaInvitacion {
  id: number
  activo: boolean
  rol: string
  auth_user_id: string | null
  actualizado_en: string
}

const schemaInvitacion = z.object({
  nombre: z.string().trim().min(3).max(150),
  email: z.email().toLowerCase().refine((email) => !email.endsWith('@legacy.laprotec')),
  proposito: z.enum(['administracion', 'acceso']).default('administracion'),
})
const schemaEnlace = z.object({ id: z.uuid(), token: z.string().min(1).max(2048) })
const digest = (token: string) => createHash('sha256').update(token).digest('hex')
const NO_DISPONIBLE = 'La invitación venció, se canceló, ya se usó o la cuenta cambió. Pida a administración un nuevo enlace.'
const MINUTOS_PARA_RETOMAR = 30
type InvitacionAceptacion = {
  auth_user_id: string; email: string; nombre: string; tipo: 'invite' | 'recovery'; proposito: PropositoInvitacion
  token_digest: string; aceptada_en: string | null; revocada_en: string | null; vence_en: string
  sesion_enlace_id: string | null; enlace_verificado_en: string | null
}

function disponible(invitacion: InvitacionAceptacion | null): invitacion is InvitacionAceptacion {
  return !!invitacion && !invitacion.aceptada_en && !invitacion.revocada_en && Date.parse(invitacion.vence_en) > Date.now()
}

function cuentaInvitada(user: User | null, invitacion: InvitacionAceptacion): user is User {
  return !!user && user.id === invitacion.auth_user_id && user.email?.toLowerCase() === invitacion.email && !!user.email_confirmed_at
}

function rutaRetomarInvitacion(id: string) {
  return `/invitacion/admin?${new URLSearchParams({ id, continuar: '1' })}`
}

async function sesionInvitacion(supabase: Awaited<ReturnType<typeof createClient>>, user: User, accessToken: string) {
  const { data, error } = await supabase.auth.getClaims(accessToken)
  const sessionId = data?.claims.session_id
  if (error || data?.claims.sub !== user.id || !z.uuid().safeParse(sessionId).success) throw new AvisoAdmin(NO_DISPONIBLE)
  return sessionId as string
}

async function retomarInvitacion(db: NonNullable<ReturnType<typeof createAdmin>>, supabase: Awaited<ReturnType<typeof createClient>>, invitacion: InvitacionAceptacion) {
  const verificadaEn = Date.parse(invitacion.enlace_verificado_en ?? '')
  if (!invitacion.sesion_enlace_id || !Number.isFinite(verificadaEn) || verificadaEn + MINUTOS_PARA_RETOMAR * 60_000 <= Date.now()) throw new AvisoAdmin(NO_DISPONIBLE)
  const { data: { user }, error: errorUser } = await supabase.auth.getUser()
  if (errorUser || !cuentaInvitada(user, invitacion)) throw new AvisoAdmin(NO_DISPONIBLE)
  // getSession only supplies the bearer token; getUser/getClaims and the live
  // server-side session decide whether this is the session that used the link.
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session) throw new AvisoAdmin(NO_DISPONIBLE)
  const sessionId = await sesionInvitacion(supabase, user, session.access_token)
  if (sessionId !== invitacion.sesion_enlace_id) throw new AvisoAdmin(NO_DISPONIBLE)
  const vigente = await db.rpc('sesion_administracion_vigente', { p_auth_user_id: user.id, p_session_id: sessionId })
  if (vigente.error || vigente.data !== true) throw new AvisoAdmin(NO_DISPONIBLE)
  return { user, sessionId, accessToken: session.access_token }
}

function avisoBaseDatos(error: { code?: string; message?: string }, alternativa: string): never {
  // Only our database validation errors are appropriate to show to an operator.
  throw new AvisoAdmin(error.code === 'P0001' && error.message ? error.message : alternativa)
}

export async function listarInvitacionesAdmin(): Promise<FilaInvitacionAdmin[]> {
  await requerirRol('admin')
  const db = createAdmin()
  if (!db) throw new SinClaveAdmin()
  const filas: FilaInvitacionAdmin[] = []
  const tamano = 500
  const ahora = Date.now()
  for (let desde = 0; ; desde += tamano) {
    const { data, error } = await db.from('invitaciones_admin')
      .select('id,email,nombre,invitado_por,creado_en,vence_en,aceptada_en,revocada_en,enviada_en,error_envio_en,target_usuario_id,proposito,invitador:usuarios!invitaciones_admin_invitado_por_fkey(nombre)')
      .order('creado_en', { ascending: false }).order('id', { ascending: false }).range(desde, desde + tamano - 1)
    if (error) throw new AvisoAdmin('No pudimos cargar las invitaciones. Intente de nuevo.')
    for (const fila of data ?? []) {
      const { invitador, ...datos } = fila
      const actor = Array.isArray(invitador) ? invitador[0] : invitador
      filas.push({ ...datos, invitador_nombre: actor?.nombre ?? null,
        estado: fila.aceptada_en ? 'aceptada' : fila.revocada_en ? 'revocada' : Date.parse(fila.vence_en) <= ahora ? 'vencida' : 'pendiente',
      } as FilaInvitacionAdmin)
    }
    if (!data || data.length < tamano) return filas
  }
}

export async function invitarAdmin(input: { nombre: string; email: string; enviarPorCorreo?: boolean; proposito?: PropositoInvitacion }) {
  const actor = await requerirRol('admin')
  if (input.enviarPorCorreo && !correoResenasConfigurado()) throw new AvisoAdmin('El envío automático no está disponible. Genere el enlace y compártalo por su propio correo.')
  const parsed = schemaInvitacion.safeParse(input)
  if (!parsed.success) throw new AvisoAdmin('Escriba un nombre y un correo real válidos.')
  const { nombre, email, proposito } = parsed.data
  const db = createAdmin({ requestTimeoutMs: 20_000 })
  if (!db) throw new SinClaveAdmin()
  const { data: existente, error: errorCuenta } = await db.rpc('cuenta_para_invitacion_admin', { p_admin_id: actor.id, p_email: email }).maybeSingle<CuentaInvitacion>()
  if (errorCuenta) avisoBaseDatos(errorCuenta, 'No se pudo verificar la cuenta. Actualice la lista e intente de nuevo.')
  if (existente && !existente.activo) throw new AvisoAdmin('La cuenta está inactiva. Actívela desde sus permisos antes de enviar una invitación.')
  if (proposito === 'administracion' && existente?.rol === 'admin') throw new AvisoAdmin('Esta cuenta ya tiene permisos de administración.')
  if (proposito === 'acceso' && (!existente || existente.auth_user_id)) throw new AvisoAdmin('Seleccione una cuenta existente sin inicio de sesión.')
  const { data: anterior, error: errorAnterior } = await db.from('invitaciones_admin')
    .select('auth_user_id').eq('email', email).order('creado_en', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle()
  if (errorAnterior) throw new AvisoAdmin('No se pudo consultar las invitaciones. Intente de nuevo.')

  let tipo: 'invite' | 'recovery' = 'invite'
  const authEsperado = existente?.auth_user_id ?? anterior?.auth_user_id
  if (authEsperado) {
    const { data, error } = await db.auth.admin.getUserById(authEsperado)
    if (error || !data.user || data.user.email?.toLowerCase() !== email) throw new AvisoAdmin('No se pudo verificar el inicio de sesión asociado a ese correo.')
    if (data.user.email_confirmed_at) tipo = 'recovery'
  }
  const id = randomUUID()
  const { error: errorReserva } = await db.rpc('reservar_emision_invitacion_admin', { p_admin_id: actor.id, p_email: email, p_id: id })
  if (errorReserva) avisoBaseDatos(errorReserva, 'No se pudo iniciar la invitación. Intente de nuevo.')
  try {
    let generado = await db.auth.admin.generateLink({ type: tipo, email })
    // A confirmed Auth identity can predate the imported profile or a failed save.
    // Recovery still proves the same mailbox, and never grants a role by itself.
    if (tipo === 'invite' && ['email_exists', 'user_already_exists'].includes(generado.error?.code ?? '')) {
      tipo = 'recovery'
      generado = await db.auth.admin.generateLink({ type: tipo, email })
    }
    const { data, error } = generado
    if (error || !data.user || data.user.email?.toLowerCase() !== email || !data.properties?.hashed_token) throw new AvisoAdmin('No se pudo crear el enlace. Intente de nuevo.')
    if (authEsperado && data.user.id !== authEsperado) throw new AvisoAdmin('El inicio de sesión cambió. Actualice la cuenta antes de continuar.')

    const token = data.properties.hashed_token
    const venceEn = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const { error: errorGuardar } = await db.rpc('registrar_invitacion_admin', {
      p_id: id, p_admin_id: actor.id, p_email: email, p_nombre: nombre, p_auth_user_id: data.user.id,
      p_digest: digest(token), p_tipo: tipo, p_vence_en: venceEn, p_proposito: proposito,
      p_target_usuario_id: existente?.id ?? null, p_target_version: existente?.actualizado_en ?? null,
    })
    if (errorGuardar) avisoBaseDatos(errorGuardar, 'No se pudo guardar la invitación. Intente de nuevo; todavía no se otorgó acceso.')
    // A fixed trusted origin prevents privileged links pointing at a forged host.
    const enlace = new URL('/invitacion/admin', 'https://www.protectoradelalquiler.com')
    enlace.searchParams.set('id', id)
    enlace.searchParams.set('token', token)
    const resultado = { enlace: enlace.toString(), email, venceEn, proposito }
    if (!input.enviarPorCorreo) return { ...resultado, enviada: false, advertencia: undefined }
    const administracion = proposito === 'administracion'
    const enviado = await enviarCorreo({
      to: email,
      subject: `${administracion ? 'Invitación de administración' : 'Active su inicio de sesión'} · La Protectora del Alquiler`,
      contenido: {
        titulo: administracion ? 'Su invitación de administración' : 'Active su inicio de sesión',
        resumen: 'Complete su invitación en La Protectora del Alquiler.',
        parrafos: [
          `Hola, ${nombre}.`,
          administracion ? 'Le invitamos a administrar La Protectora del Alquiler. No necesita escribir una reseña.' : 'Le invitamos a crear el inicio de sesión para su cuenta. Su rol y los requisitos para consultar fichas se mantienen.',
          'Abra el enlace y elija una clave nueva para aceptar. Se cerrarán las otras sesiones de esta cuenta.',
        ],
        accion: { texto: 'Aceptar invitación', url: enlace.toString() },
        nota: 'El enlace es de un solo uso y vence según la configuración de autenticación, como máximo en 24 horas. Si no esperaba esta invitación, ignórela. No comparta el enlace.',
      },
      text: `Hola, ${nombre}.\n\n${administracion ? 'Le invitamos a administrar La Protectora del Alquiler. No necesita escribir una reseña.' : 'Le invitamos a crear el inicio de sesión para su cuenta. Su rol y los requisitos para consultar fichas se mantienen.'} Abra el enlace y elija una clave nueva para aceptar. Se cerrarán las otras sesiones de esta cuenta.\n\n${enlace}\n\nEl enlace es de un solo uso y vence según la configuración de autenticación, como máximo en 24 horas. Si no esperaba esta invitación, ignórela.`,
    })
    const { error: errorEntrega } = await db.from('invitaciones_admin')
      .update(enviado ? { enviada_en: new Date().toISOString() } : { error_envio_en: new Date().toISOString() }).eq('id', id)
    return { ...resultado, enviada: enviado,
      advertencia: !enviado ? 'No pudimos confirmar el envío. Puede copiar el enlace y enviarlo desde su propio correo.'
        : errorEntrega ? 'El correo se envió, pero no se pudo guardar su estado en el historial.' : undefined,
    }
  } finally {
    // Keep issuance exclusive through delivery. The lease also recovers after
    // a process crash or an unavailable database prevents this cleanup.
    try { await db.rpc('liberar_emision_invitacion_admin', { p_id: id }) } catch { /* expires automatically */ }
  }
}

export async function cancelarInvitacionAdmin(id: string) {
  const actor = await requerirRol('admin')
  if (!z.uuid().safeParse(id).success) throw new AvisoAdmin('Revise la invitación que desea cancelar.')
  const db = createAdmin()
  if (!db) throw new SinClaveAdmin()
  const { error } = await db.rpc('cancelar_invitacion_admin', { p_admin_id: actor.id, p_id: id })
  if (error) avisoBaseDatos(error, 'No se pudo cancelar la invitación. Intente de nuevo.')
}

/** Read-only preview: opening a link does not consume its one-use Auth token. */
export async function consultarInvitacionAdmin(id: string, token: string) {
  if (!schemaEnlace.safeParse({ id, token }).success) return null
  const db = createAdmin()
  if (!db) return null
  const { data, error } = await db.from('invitaciones_admin')
    .select('nombre,email,proposito,aceptada_en,revocada_en,vence_en')
    .eq('id', id).eq('token_digest', digest(token)).maybeSingle()
  if (error || !data || data.aceptada_en || data.revocada_en || Date.parse(data.vence_en) <= Date.now()) return null
  return { nombre: String(data.nombre), email: String(data.email), proposito: data.proposito as PropositoInvitacion }
}

/** The consumed link can resume only in the same verified, live Auth session. */
export async function consultarInvitacionPendiente(id: string) {
  if (!z.uuid().safeParse(id).success) return null
  const db = createAdmin()
  if (!db) return null
  const { data, error } = await db.from('invitaciones_admin').select('*').eq('id', id).maybeSingle<InvitacionAceptacion>()
  if (error || !disponible(data)) return null
  const supabase = await createClient()
  let sesion
  try { sesion = await retomarInvitacion(db, supabase, data) } catch (error) {
    if (error instanceof AvisoAdmin) return null
    throw error
  }
  if (await requiereSegundoFactor(supabase, sesion.user)) redirect(rutaSegundoFactor(rutaRetomarInvitacion(id)))
  return { nombre: data.nombre, email: data.email, proposito: data.proposito }
}

export async function aceptarInvitacionAdmin(input: { id: string; token: string; clave: string; confirmacion: string }) {
  const parsed = schemaEnlace.extend({
    token: z.string().max(2048), // Empty only when resuming a server-bound session.
    clave: z.string().min(8).max(72).regex(/[a-zA-Z]/).regex(/[0-9]/), confirmacion: z.string(),
  }).refine((v) => v.clave === v.confirmacion).safeParse(input)
  if (!parsed.success) throw new AvisoAdmin('Revise el enlace y use una clave de 8 a 72 caracteres, con letras y números. Las claves deben coincidir.')
  const db = createAdmin()
  if (!db) throw new SinClaveAdmin()
  let consulta = db.from('invitaciones_admin').select('*').eq('id', parsed.data.id)
  if (parsed.data.token) consulta = consulta.eq('token_digest', digest(parsed.data.token))
  const { data: invitacion, error } = await consulta.maybeSingle<InvitacionAceptacion>()
  if (error || !disponible(invitacion)) throw new AvisoAdmin(NO_DISPONIBLE)
  const supabase = await createClient()
  let sesion: { user: User; sessionId: string; accessToken: string }
  if (invitacion.sesion_enlace_id) {
    sesion = await retomarInvitacion(db, supabase, invitacion)
  } else {
    if (!parsed.data.token) throw new AvisoAdmin(NO_DISPONIBLE)
    const { data, error: errorToken } = await supabase.auth.verifyOtp({ token_hash: parsed.data.token, type: invitacion.tipo })
    if (errorToken || !data.session || !cuentaInvitada(data.user, invitacion)) throw new AvisoAdmin(NO_DISPONIBLE)
    sesion = { user: data.user, accessToken: data.session.access_token,
      sessionId: await sesionInvitacion(supabase, data.user, data.session.access_token) }
  }
  if (await requiereSegundoFactor(supabase, sesion.user)) {
    if (!invitacion.sesion_enlace_id) {
      const { data: guardada, error } = await db.from('invitaciones_admin')
        .update({ sesion_enlace_id: sesion.sessionId, enlace_verificado_en: new Date().toISOString() })
        .eq('id', parsed.data.id).eq('token_digest', invitacion.token_digest)
        .is('sesion_enlace_id', null).is('aceptada_en', null).is('revocada_en', null)
        .select('id').maybeSingle()
      if (error || !guardada) throw new AvisoAdmin(NO_DISPONIBLE)
    }
    // Do not persist the password or carry the consumed link through redirects.
    redirect(rutaSegundoFactor(rutaRetomarInvitacion(parsed.data.id)))
  }
  const { error: errorClave } = await supabase.auth.updateUser({ password: parsed.data.clave })
  if (errorClave) throw new AvisoAdmin(invitacion.sesion_enlace_id ? 'No se pudo guardar la clave. Revise la clave e intente de nuevo.' : 'No se pudo guardar la clave. Pida un nuevo enlace de invitación e intente de nuevo.')
  // The admin API surfaces revocation errors instead of swallowing 401/403.
  // The database also checks auth.sessions: old JWTs alone grant no admin access.
  const { error: errorSesiones } = await db.auth.admin.signOut(sesion.accessToken, 'others')
  if (errorSesiones) throw new AvisoAdmin('No se pudieron cerrar las otras sesiones. Pida un nuevo enlace de invitación.')
  const { error: errorAceptar } = await db.rpc('aceptar_invitacion_admin', {
    p_id: parsed.data.id, p_auth_user_id: sesion.user.id, p_digest: invitacion.token_digest, p_session_id: sesion.sessionId,
  })
  if (errorAceptar) throw new AvisoAdmin(NO_DISPONIBLE)
  return { proposito: invitacion.proposito as PropositoInvitacion }
}
