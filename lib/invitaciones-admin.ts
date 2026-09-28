import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import * as z from 'zod'
import { requerirRol } from '@/lib/dal'
import { createAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { correoResenasConfigurado, enviarCorreo } from '@/lib/correo-resenas'
import { AvisoAdmin, SinClaveAdmin } from '@/lib/admin'

const schemaInvitacion = z.object({ nombre: z.string().trim().min(3).max(150), email: z.email().toLowerCase() })
const digest = (token: string) => createHash('sha256').update(token).digest('hex')
const NO_DISPONIBLE = 'La invitación venció, ya se usó o no está disponible. Pida a administración un nuevo enlace.'

export async function invitarAdmin(input: { nombre: string; email: string }) {
  const actor = await requerirRol('admin')
  if (!correoResenasConfigurado()) throw new AvisoAdmin('Resend aún no está configurado. Las invitaciones por correo están deshabilitadas.')
  const parsed = schemaInvitacion.safeParse(input)
  if (!parsed.success) throw new AvisoAdmin('Escriba un nombre y un correo válidos.')
  const { nombre, email } = parsed.data
  const db = createAdmin()
  if (!db) throw new SinClaveAdmin()
  const { data: existente, error: errorCuenta } = await db.from('usuarios').select('id').ilike('email', email).maybeSingle()
  if (errorCuenta) throw errorCuenta
  if (existente) throw new AvisoAdmin('Ese correo ya tiene cuenta. Cambie su rol desde la lista de usuarios.')
  const { data: anterior, error: errorAnterior } = await db.from('invitaciones_admin').select('auth_user_id, aceptada_en').eq('email', email).maybeSingle()
  if (errorAnterior) throw new AvisoAdmin('No se pudo consultar las invitaciones. Verifique que se aplicó la migración de invitaciones.')
  if (anterior?.aceptada_en) throw new AvisoAdmin('Esa invitación ya fue aceptada. Revise la cuenta existente.')

  let tipo: 'invite' | 'recovery' = 'invite'
  if (anterior) {
    const { data, error } = await db.auth.admin.getUserById(anterior.auth_user_id)
    if (error || data.user.email?.toLowerCase() !== email) throw new AvisoAdmin('No se pudo renovar la invitación.')
    if (data.user.email_confirmed_at) tipo = 'recovery'
  }
  const { data, error } = await db.auth.admin.generateLink({ type: tipo, email })
  if (error || !data.user || !data.properties?.hashed_token) throw new AvisoAdmin('No se pudo crear el enlace. Si el correo ya tiene una cuenta, administre su rol desde Usuarios.')
  if (anterior && data.user.id !== anterior.auth_user_id) throw new AvisoAdmin('La cuenta cambió. Revise la invitación antes de continuar.')

  const id = randomUUID()
  const token = data.properties.hashed_token
  const { error: errorGuardar } = await db.from('invitaciones_admin').upsert({
    id, email, nombre, auth_user_id: data.user.id, invitado_por: actor.id,
    token_digest: digest(token), tipo, vence_en: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    aceptada_en: null, creado_en: new Date().toISOString(),
  }, { onConflict: 'email' })
  if (errorGuardar) throw new AvisoAdmin('No se pudo guardar la invitación. Puede volver a intentar; todavía no se otorgó acceso.')
  // Fixed trusted origin: never derive a privileged invite link from request headers.
  const enlace = new URL('/invitacion/admin', 'https://www.protectoradelalquiler.com')
  enlace.searchParams.set('id', id)
  enlace.searchParams.set('token', token)
  const enviado = await enviarCorreo({
    to: email,
    subject: 'Invitación de administración · La Protectora del Alquiler',
    text: `Hola, ${nombre}.\n\nLe invitamos a administrar La Protectora del Alquiler. Abra el enlace y elija una clave para aceptar. No necesita escribir una reseña.\n\n${enlace}\n\nEl enlace es de un solo uso y vence según la configuración de autenticación, como máximo en 24 horas. Si no esperaba esta invitación, ignórela.`,
  })
  if (!enviado) throw new AvisoAdmin('No pudimos confirmar el envío. Todavía no se otorgó acceso. Revise Resend; puede reenviar la invitación con este formulario.')
}

export async function aceptarInvitacionAdmin(input: { id: string; token: string; clave: string; confirmacion: string }) {
  const parsed = z.object({
    id: z.uuid(), token: z.string().min(1).max(2048),
    clave: z.string().min(8).max(72).regex(/[a-zA-Z]/).regex(/[0-9]/), confirmacion: z.string(),
  }).refine((v) => v.clave === v.confirmacion).safeParse(input)
  if (!parsed.success) throw new AvisoAdmin('Revise el enlace y use una clave de 8 a 72 caracteres, con letras y números. Las claves deben coincidir.')
  const db = createAdmin()
  if (!db) throw new SinClaveAdmin()
  const huella = digest(parsed.data.token)
  const { data: invitacion, error } = await db.from('invitaciones_admin')
    .select('auth_user_id, email, tipo, aceptada_en, vence_en')
    .eq('id', parsed.data.id).eq('token_digest', huella).maybeSingle()
  if (error || !invitacion || invitacion.aceptada_en || Date.parse(invitacion.vence_en) <= Date.now()) throw new AvisoAdmin(NO_DISPONIBLE)
  const supabase = await createClient()
  const { data, error: errorToken } = await supabase.auth.verifyOtp({ token_hash: parsed.data.token, type: invitacion.tipo })
  if (errorToken || !data.user || data.user.id !== invitacion.auth_user_id || data.user.email?.toLowerCase() !== invitacion.email || !data.user.email_confirmed_at) {
    throw new AvisoAdmin(NO_DISPONIBLE)
  }
  const { error: errorClave } = await supabase.auth.updateUser({ password: parsed.data.clave })
  if (errorClave) throw new AvisoAdmin('No se pudo guardar la clave. Pida un nuevo enlace de invitación e intente de nuevo.')
  // Revoke any older sessions before granting privileges, including pre-existing unconfirmed signups.
  const { error: errorSesiones } = await supabase.auth.signOut({ scope: 'others' })
  if (errorSesiones) throw new AvisoAdmin('No se pudo asegurar la cuenta. Pida un nuevo enlace de invitación.')
  const { error: errorAceptar } = await db.rpc('aceptar_invitacion_admin', {
    p_id: parsed.data.id, p_auth_user_id: data.user.id, p_digest: huella,
  })
  if (errorAceptar) throw new AvisoAdmin(NO_DISPONIBLE)
}
