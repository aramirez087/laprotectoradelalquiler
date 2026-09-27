'use server'

import { redirect } from 'next/navigation'
import * as z from 'zod'
import { requireUsuario } from '@/lib/dal'
import { createClient, sinSupabase } from '@/lib/supabase/server'
import { destinoInterno } from '@/lib/util'
import type { Rol } from '@/lib/tipos'

export type EstadoForm = {
  error?: string
  mensaje?: string
} | undefined

const SchemaRegistro = z.object({
  nombre: z.string().min(3, 'Escriba su nombre completo'),
  email: z.email('Escriba un correo válido'),
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

export async function registrarse(_estado: EstadoForm, formData: FormData): Promise<EstadoForm> {
  if (sinSupabase()) return avisoSinSupabase()

  const parsed = SchemaRegistro.safeParse({
    nombre: formData.get('nombre'),
    email: (formData.get('email') as string)?.toLowerCase(),
    clave: formData.get('clave'),
    rol: formData.get('rol'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }
  const { nombre, email, clave, rol } = parsed.data

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password: clave,
    options: { data: { nombre, rol } },
  })
  if (error) {
    return { error: /already|registered/i.test(error.message) ? 'Ese correo ya tiene cuenta. Inicie sesión.' : error.message }
  }

  // Crear perfil en `usuarios` (self-healing también lo haría, pero así es inmediato)
  if (data.user) {
    await supabase.from('usuarios').upsert(
      {
        auth_user_id: data.user.id,
        email,
        nombre,
        rol: rol as Rol,
      },
      { onConflict: 'auth_user_id' },
    )
  }

  if (data.session) {
    redirect('/fichas')
  }
  return {
    mensaje: 'Cuenta creada. Revise su correo para confirmar el registro y luego inicie sesión.',
  }
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
