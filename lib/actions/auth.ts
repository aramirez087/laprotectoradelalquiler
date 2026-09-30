'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import * as z from 'zod'
import { COOKIE_CORREO } from '@/lib/correo-recordado'
import { requireUsuario, destinoTrasLogin } from '@/lib/dal'
import { authFacebookHabilitado, cuentaCreadaConFacebook } from '@/lib/facebook-auth'
import { createAdmin } from '@/lib/supabase/admin'
import { createClient, sinSupabase } from '@/lib/supabase/server'
import { destinoInterno, esCedulaValida, normalizarCedula, normalizarPerfilFacebook } from '@/lib/util'
import type { Rol } from '@/lib/tipos'

export type EstadoForm = {
  error?: string
  campos?: Record<string, string>
  mensaje?: string
  advertencia?: string
  invitacion?: { enlace: string; email: string; venceEn: string; proposito: 'administracion' | 'acceso' }
} | undefined

const SchemaRegistro = z.object({
  nombre: z.string().min(3, 'Escriba su nombre completo'),
  email: z.email('Escriba un correo válido'),
  cedula: z.string().trim().min(1, 'Escriba su número de cédula'),
  facebook: z.string().trim().min(1, 'Escriba su perfil de Facebook'),
  clave: z
    .string()
    .min(8, 'La clave debe tener al menos 8 caracteres')
    .regex(/[a-zA-Z]/, 'Debe incluir letras')
    .regex(/[0-9]/, 'Debe incluir números'),
  rol: z.enum(['propietario', 'agencia'], { error: 'Elija si es propietario o agencia.' }),
})

const SchemaLogin = z.object({
  email: z.email('Escriba un correo válido'),
  clave: z.string().min(1, 'Escriba su clave'),
})

const CUENTA_OCUPADA = 'No pudimos crear la cuenta. Si ya está registrado, inicie sesión.'

function avisoSinSupabase() {
  return {
    error:
      'El backend aún no está configurado. Cree un proyecto en Supabase, copie .env.example a .env.local y rellene las credenciales. Luego corra: npm run db:aplicar',
  } satisfies EstadoForm
}

async function deshacerRegistro(admin: NonNullable<ReturnType<typeof createAdmin>>, authUserId: string) {
  const { data } = await admin.from('usuarios').select('id').eq('auth_user_id', authUserId).maybeSingle()
  if (data?.id) {
    await admin.from('autenticaciones').delete().eq('usuario_id', data.id)
    await admin.from('usuarios').delete().eq('id', data.id)
  }
  await admin.auth.admin.deleteUser(authUserId)
}

async function cedulaEnUso(admin: NonNullable<ReturnType<typeof createAdmin>>, cedula: string, email: string) {
  const digitos = cedula.replace(/\D/g, '')
  const { data, error } = await admin
    .from('usuarios')
    .select('email, identificacion')
    .ilike('identificacion', `%${[...digitos].join('%')}%`)
    .limit(40)
  if (error) throw error
  return (data ?? []).some(
    (fila) => (fila.identificacion ?? '').replace(/\D/g, '') === digitos && fila.email?.toLowerCase() !== email,
  )
}

export async function registrarse(_estado: EstadoForm, formData: FormData): Promise<EstadoForm> {
  if (sinSupabase()) return avisoSinSupabase()

  const parsed = SchemaRegistro.safeParse({
    nombre: formData.get('nombre'),
    email: (formData.get('email') as string)?.toLowerCase(),
    cedula: formData.get('cedula'),
    facebook: formData.get('facebook'),
    clave: formData.get('clave'),
    rol: formData.get('rol'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }
  const { nombre, email, clave, rol } = parsed.data
  const cedula = normalizarCedula(parsed.data.cedula)
  const facebook = normalizarPerfilFacebook(parsed.data.facebook) ?? parsed.data.facebook
  if (!esCedulaValida(cedula)) {
    return { error: 'Escriba su cédula con 6 a 12 dígitos. Puede incluir guiones.' }
  }

  const admin = createAdmin()
  if (!admin) {
    return { error: 'El registro no está disponible en este momento. Falta la configuración de administración.' }
  }

  try {
    if (await cedulaEnUso(admin, cedula, email)) return { error: CUENTA_OCUPADA }
    const { data: facebookTomado, error: errorFacebook } = await admin
      .from('autenticaciones')
      .select('id')
      .eq('proveedor', 'facebook')
      .eq('proveedor_id', facebook)
      .maybeSingle()
    if (errorFacebook) return { error: 'No pudimos revisar el perfil de Facebook. Intente de nuevo.' }
    if (facebookTomado) return { error: CUENTA_OCUPADA }

    const { data: porEmail, error: errorEmail } = await admin
      .from('usuarios')
      .select('id, auth_user_id')
      .eq('email', email)
      .maybeSingle()
    if (errorEmail) return { error: 'No pudimos crear la cuenta. Intente de nuevo.' }
    if (porEmail) return { error: CUENTA_OCUPADA }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: clave,
      email_confirm: true,
      user_metadata: { nombre, rol, identificacion: cedula, facebook },
    })
    if (error || !data.user) {
      return {
        error:
          error && /already|registered/i.test(error.message)
            ? CUENTA_OCUPADA
            : 'No pudimos crear la cuenta. Intente de nuevo.',
      }
    }
    const authUserId = data.user.id

    const perfil = await admin
      .from('usuarios')
      .insert({
        auth_user_id: authUserId,
        email,
        nombre,
        rol,
        identificacion: cedula,
      })
      .select('id')
      .single()
    if (perfil.error || !perfil.data) {
      await deshacerRegistro(admin, authUserId)
      return { error: 'No pudimos guardar su perfil. Intente de nuevo.' }
    }

    const { error: errorPerfilFacebook } = await admin.from('autenticaciones').insert({
      usuario_id: perfil.data.id,
      proveedor: 'facebook',
      proveedor_id: facebook,
    })
    if (errorPerfilFacebook) {
      await deshacerRegistro(admin, authUserId)
      return {
        error:
          errorPerfilFacebook.code === '23505'
            ? CUENTA_OCUPADA
            : 'No pudimos guardar su perfil de Facebook. Intente de nuevo.',
      }
    }

    const supabase = await createClient()
    let { error: errorSesion } = await supabase.auth.signInWithPassword({ email, password: clave })
    if (errorSesion && /email not confirmed/i.test(errorSesion.message)) {
      await admin.auth.admin.updateUserById(authUserId, { email_confirm: true })
      ;({ error: errorSesion } = await supabase.auth.signInWithPassword({ email, password: clave }))
    }
    if (errorSesion) {
      return { error: 'Su cuenta quedó creada. Inicie sesión para escribir la reseña.' }
    }
  } catch {
    return { error: 'No pudimos crear la cuenta. Intente de nuevo.' }
  }

  redirect('/registro/resena')
}

const SchemaAltaFacebook = z.object({
  nombre: z.string().trim().min(3, 'Escriba su nombre completo'),
  email: z.email('Escriba un correo válido'),
  cedula: z.string().trim().min(1, 'Escriba su número de cédula'),
  facebook: z.string().trim().min(1, 'Escriba su perfil de Facebook'),
  rol: z.enum(['propietario', 'agencia'], { error: 'Elija si es propietario o agencia.' }).optional(),
})

async function guardarPerfilFacebook(
  admin: NonNullable<ReturnType<typeof createAdmin>>,
  usuarioId: number,
  facebook: string,
) {
  const { data: propio, error: errorPropio } = await admin
    .from('autenticaciones')
    .select('id, proveedor_id')
    .eq('usuario_id', usuarioId)
    .eq('proveedor', 'facebook')
    .maybeSingle()
  if (errorPropio) return { error: 'No pudimos guardar su perfil de Facebook. Intente de nuevo.' }
  if (propio?.proveedor_id === facebook) return { error: null }
  const { data: ajeno, error: errorAjeno } = await admin
    .from('autenticaciones')
    .select('id')
    .eq('proveedor', 'facebook')
    .eq('proveedor_id', facebook)
    .maybeSingle()
  if (errorAjeno) return { error: 'No pudimos revisar el perfil de Facebook. Intente de nuevo.' }
  if (ajeno && ajeno.id !== propio?.id) return { error: CUENTA_OCUPADA }
  if (propio) {
    const { error } = await admin.from('autenticaciones').update({ proveedor_id: facebook }).eq('id', propio.id)
    return {
      error: error
        ? error.code === '23505'
          ? CUENTA_OCUPADA
          : 'No pudimos guardar su perfil de Facebook. Intente de nuevo.'
        : null,
    }
  }
  const { error } = await admin.from('autenticaciones').insert({
    usuario_id: usuarioId,
    proveedor: 'facebook',
    proveedor_id: facebook,
  })
  return {
    error: error
      ? error.code === '23505'
        ? CUENTA_OCUPADA
        : 'No pudimos guardar su perfil de Facebook. Intente de nuevo.'
      : null,
  }
}

export async function completarAltaFacebook(_estado: EstadoForm, formData: FormData): Promise<EstadoForm> {
  if (!authFacebookHabilitado()) return { error: 'El ingreso con Facebook no está disponible.' }
  if (sinSupabase()) return avisoSinSupabase()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !cuentaCreadaConFacebook(user)) {
    return { error: 'La sesión de Facebook venció. Entre de nuevo.' }
  }

  const emailSesion = user.email?.trim().toLowerCase() ?? ''
  if (!emailSesion) {
    return { error: 'Facebook no confirmó un correo. Use una cuenta de Facebook con correo confirmado.' }
  }
  const parsed = SchemaAltaFacebook.safeParse({
    nombre: formData.get('nombre'),
    email: emailSesion,
    cedula: formData.get('cedula'),
    facebook: formData.get('facebook'),
    rol: formData.get('rol') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Revise los datos.' }

  const { nombre, email } = parsed.data
  const cedula = normalizarCedula(parsed.data.cedula)
  const facebook = normalizarPerfilFacebook(parsed.data.facebook) ?? parsed.data.facebook
  if (!esCedulaValida(cedula)) {
    return { error: 'Escriba su cédula con 6 a 12 dígitos. Puede incluir guiones.' }
  }
  const admin = createAdmin()
  if (!admin) {
    return { error: 'El registro no está disponible en este momento. Falta la configuración de administración.' }
  }

  let creado = false
  let usuarioId = 0
  try {
    if (await cedulaEnUso(admin, cedula, email)) return { error: CUENTA_OCUPADA }

    const { data: porAuth, error: errorAuth } = await admin
      .from('usuarios')
      .select('id, auth_user_id, rol')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if (errorAuth) return { error: 'No pudimos guardar su perfil. Intente de nuevo.' }
    const { data: porEmail, error: errorEmail } = await admin
      .from('usuarios')
      .select('id, auth_user_id, rol')
      .eq('email', email)
      .maybeSingle()
    if (errorEmail) return { error: 'No pudimos guardar su perfil. Intente de nuevo.' }
    if (porEmail && porEmail.id !== porAuth?.id) return { error: CUENTA_OCUPADA }

    const existente = porAuth
    if (!existente) {
      if (!parsed.data.rol) return { error: 'Elija si es propietario o agencia.' }
      const perfil = await admin
        .from('usuarios')
        .insert({
          auth_user_id: user.id,
          email,
          nombre,
          rol: parsed.data.rol,
          identificacion: cedula,
        })
        .select('id')
        .single()
      if (perfil.error || !perfil.data) return { error: 'No pudimos guardar su perfil. Intente de nuevo.' }
      usuarioId = perfil.data.id
      creado = true
    } else {
      const perfil = await admin
        .from('usuarios')
        .update({
          auth_user_id: user.id,
          nombre,
          identificacion: cedula,
          actualizado_en: new Date().toISOString(),
        })
        .eq('id', existente.id)
        .select('id')
        .single()
      if (perfil.error || !perfil.data) return { error: 'No pudimos guardar su perfil. Intente de nuevo.' }
      usuarioId = perfil.data.id
    }

    const guardado = await guardarPerfilFacebook(admin, usuarioId, facebook)
    if (guardado.error) {
      if (creado) {
        await admin.from('usuarios').delete().eq('id', usuarioId)
      }
      return { error: guardado.error }
    }

    const rolCuenta = (existente?.rol as Rol | undefined) ?? parsed.data.rol
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        nombre,
        ...(rolCuenta ? { rol: rolCuenta } : {}),
        identificacion: cedula,
        facebook,
      },
    })
  } catch {
    return { error: 'No pudimos guardar su perfil. Intente de nuevo.' }
  }

  redirect('/registro/resena')
}

export async function iniciarSesion(_estado: EstadoForm, formData: FormData): Promise<EstadoForm> {
  if (sinSupabase()) return avisoSinSupabase()

  const parsed = SchemaLogin.safeParse({
    email: (formData.get('email') as string)?.toLowerCase(),
    clave: formData.get('clave'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.clave,
  })
  if (error) {
    if (/email not confirmed/i.test(error.message)) {
      return { error: 'Confirme su correo antes de entrar. Revise la bandeja de entrada.' }
    }
    if (/rate limit/i.test(error.message)) {
      return { error: 'Espere un momento antes de intentar de nuevo.' }
    }
    return { error: 'Correo o clave incorrectos.' }
  }

  if (data.user) {
    const admin = createAdmin()
    if (admin) {
      await admin
        .from('usuarios')
        .update({ ultimo_acceso: new Date().toISOString() })
        .eq('auth_user_id', data.user.id)
    }
  }

  const jar = await cookies()
  jar.set(COOKIE_CORREO, parsed.data.email, {
    path: '/',
    maxAge: 60 * 60 * 24 * 400,
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  })
  const siguiente = destinoInterno(formData.get('siguiente'), '/')
  redirect(data.user ? await destinoTrasLogin(data.user.id, siguiente) : siguiente)
}

const SchemaClave = z
  .object({
    clave: z
      .string()
      .min(8, 'La clave debe tener al menos 8 caracteres')
      .regex(/[a-zA-Z]/, 'Debe incluir letras')
      .regex(/[0-9]/, 'Debe incluir números'),
    confirmacion: z.string(),
  })
  .refine((datos) => datos.clave === datos.confirmacion, { message: 'Las claves no coinciden.' })

async function origenDeLaPeticion() {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  if (!host) return null
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https')
  return `${proto}://${host}`
}

export async function solicitarRecuperacion(_estado: EstadoForm, formData: FormData): Promise<EstadoForm> {
  if (sinSupabase()) return avisoSinSupabase()

  const parsed = z.object({ email: z.email('Escriba un correo válido') }).safeParse({
    email: (formData.get('email') as string)?.toLowerCase(),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Escriba un correo válido.' }

  const origen = await origenDeLaPeticion()
  if (!origen) return { error: 'No pudimos armar el enlace. Intente de nuevo.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origen}/auth/confirmar?next=/restablecer`,
  })
  if (error && /redirect|not allowed/i.test(error.message)) {
    return { error: 'Falta autorizar el enlace de retorno en Supabase, en Authentication → URL Configuration.' }
  }
  if (error && /rate limit/i.test(error.message)) {
    return { error: 'Espere un momento antes de pedir otro enlace.' }
  }
  return { mensaje: 'Si ese correo tiene cuenta, le enviamos un enlace para elegir una clave nueva.' }
}

export async function establecerClave(_estado: EstadoForm, formData: FormData): Promise<EstadoForm> {
  if (sinSupabase()) return avisoSinSupabase()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'El enlace venció. Pida otro.' }

  const parsed = SchemaClave.safeParse({
    clave: formData.get('clave'),
    confirmacion: formData.get('confirmacion'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Revise la clave.' }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.clave })
  if (error) {
    if (/same password|should be different/i.test(error.message)) {
      return { error: 'Elija una clave distinta a la actual.' }
    }
    return { error: 'No pudimos guardar la clave. Pida otro enlace e intente de nuevo.' }
  }
  redirect('/')
}

export async function cambiarClave(_estado: EstadoForm, formData: FormData): Promise<EstadoForm> {
  if (sinSupabase()) return avisoSinSupabase()
  await requireUsuario()

  const parsed = SchemaClave.safeParse({
    clave: formData.get('clave'),
    confirmacion: formData.get('confirmacion'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Revise la clave.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.clave })
  if (error) {
    if (/same password|should be different/i.test(error.message)) {
      return { error: 'Elija una clave distinta a la actual.' }
    }
    return { error: 'No pudimos cambiar la clave. Intente de nuevo.' }
  }
  return { mensaje: 'Clave actualizada.' }
}

export async function cerrarSesion() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}
