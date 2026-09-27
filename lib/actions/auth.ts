'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import * as z from 'zod'
import { requireUsuario } from '@/lib/dal'
import { createAdmin } from '@/lib/supabase/admin'
import { createClient, sinSupabase } from '@/lib/supabase/server'
import { destinoInterno, esCedulaValida, normalizarCedula, normalizarPerfilFacebook } from '@/lib/util'
import type { Rol } from '@/lib/tipos'

export type EstadoForm = {
  error?: string
  campos?: Record<string, string>
  mensaje?: string
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
  rol: z.enum(['propietario', 'agencia', 'inquilino']),
})

const SchemaLogin = z.object({
  email: z.email('Escriba un correo válido'),
  clave: z.string().min(1, 'Escriba su clave'),
})

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
  const facebook = normalizarPerfilFacebook(parsed.data.facebook)
  if (!esCedulaValida(cedula)) {
    return { error: 'Escriba su cédula con 6 a 12 dígitos. Puede incluir guiones.' }
  }
  if (!facebook) {
    return { error: 'Escriba el enlace de su perfil de Facebook, o su usuario.' }
  }

  const admin = createAdmin()
  if (!admin) {
    return { error: 'El registro no está disponible en este momento. Falta la configuración de administración.' }
  }

  try {
    if (await cedulaEnUso(admin, cedula, email)) {
      return { error: 'Esa cédula ya está registrada. Si es suya, inicie sesión.' }
    }
    const { data: facebookTomado, error: errorFacebook } = await admin
      .from('autenticaciones')
      .select('id')
      .eq('proveedor', 'facebook')
      .eq('proveedor_id', facebook)
      .maybeSingle()
    if (errorFacebook) return { error: 'No pudimos revisar el perfil de Facebook. Intente de nuevo.' }
    if (facebookTomado) return { error: 'Ese perfil de Facebook ya está registrado.' }

    const { data: porEmail, error: errorEmail } = await admin
      .from('usuarios')
      .select('id, auth_user_id')
      .eq('email', email)
      .maybeSingle()
    if (errorEmail) return { error: 'No pudimos crear la cuenta. Intente de nuevo.' }
    if (porEmail?.auth_user_id) return { error: 'Ese correo ya tiene cuenta. Inicie sesión.' }

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
            ? 'Ese correo ya tiene cuenta. Inicie sesión.'
            : 'No pudimos crear la cuenta. Intente de nuevo.',
      }
    }
    const authUserId = data.user.id

    const perfil = porEmail
      ? await admin
          .from('usuarios')
          .update({
            auth_user_id: authUserId,
            nombre,
            rol,
            identificacion: cedula,
            actualizado_en: new Date().toISOString(),
          })
          .eq('id', porEmail.id)
          .select('id')
          .single()
      : await admin
          .from('usuarios')
          .insert({
            auth_user_id: authUserId,
            email,
            nombre,
            rol: rol as Rol,
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
            ? 'Ese perfil de Facebook ya está registrado.'
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
    return {
      error: /invalid login credentials/i.test(error.message) ? 'Correo o clave incorrectos.' : error.message,
    }
  }

  if (data.user) {
    await supabase.from('usuarios').upsert(
      {
        auth_user_id: data.user.id,
        email: parsed.data.email,
        nombre: (data.user.user_metadata?.nombre as string) ?? 'Usuario',
        rol: (data.user.user_metadata?.rol as Rol) ?? 'propietario',
        ultimo_acceso: new Date().toISOString(),
      },
      { onConflict: 'auth_user_id', ignoreDuplicates: true },
    )
  }

  redirect(destinoInterno(formData.get('siguiente')))
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
