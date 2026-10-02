'use server'

import * as z from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect, unstable_rethrow } from 'next/navigation'
import { requireUsuario, destinoTrasLogin } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { createAdmin } from '@/lib/supabase/admin'
import { destinoSegundoFactor } from '@/lib/dos-factores'
import type { EstadoForm } from '@/lib/actions/auth'

export type ConfiguracionDosFactores = { factorId: string; qr: string; secreto: string }
export type ResultadoDosFactores = { error?: string; configuracion?: ConfiguracionDosFactores }

const SchemaCodigo = z.object({
  factorId: z.uuid('El autenticador cambió. Vuelva a cargar la página.'),
  codigo: z.string('Escriba los 6 dígitos de su aplicación.').trim().regex(/^\d{6}$/, 'Escriba los 6 dígitos de su aplicación.'),
})

async function verificarCodigo(formData: FormData, estado: 'verified' | 'unverified') {
  const parsed = SchemaCodigo.safeParse({ factorId: formData.get('factorId'), codigo: formData.get('codigo') })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Revise el código.' }
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { error: 'Su sesión venció. Inicie sesión de nuevo.' }
  const factor = user.factors?.find(f => f.id === parsed.data.factorId && f.factor_type === 'totp' && f.status === estado)
  if (!factor) return { error: 'Este autenticador no está disponible. Vuelva a cargar la página.' }
  const verificacion = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: parsed.data.codigo })
  if (verificacion.error) {
    if ((verificacion.error.status ?? 0) >= 500 || verificacion.error.name === 'AuthRetryableFetchError') {
      return { error: 'La verificación no está disponible en este momento. Intente de nuevo más tarde.' }
    }
    return { error: verificacion.error.status === 429
      ? 'Espere un momento antes de intentar de nuevo.'
      : 'El código no es válido o venció. Use el código actual de su aplicación.' }
  }
  return { supabase, factorId: factor.id, user }
}

export async function iniciarConfiguracionDosFactores(): Promise<ResultadoDosFactores> {
  await requireUsuario('/perfil')
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) return { error: 'No pudimos consultar sus autenticadores. Intente de nuevo.' }
    if (data.totp.length) return { error: 'La verificación en dos pasos ya está activada.' }
    // Abandoned setups must never remove a verified factor.
    for (const factor of data.all.filter(f => f.factor_type === 'totp' && f.status === 'unverified')) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
      if (error) return { error: 'No pudimos reiniciar la configuración. Intente de nuevo.' }
    }
    const enrolment = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'La Protectora del Alquiler', issuer: 'La Protectora del Alquiler' })
    if (enrolment.error) return { error: 'No pudimos iniciar la configuración. Intente de nuevo más tarde.' }
    return { configuracion: { factorId: enrolment.data.id, qr: enrolment.data.totp.qr_code, secreto: enrolment.data.totp.secret } }
  } catch (error) {
    unstable_rethrow(error)
    return { error: 'No pudimos iniciar la configuración. Intente de nuevo.' }
  }
}

export async function confirmarConfiguracionDosFactores(formData: FormData): Promise<ResultadoDosFactores> {
  await requireUsuario('/perfil')
  try {
    const resultado = await verificarCodigo(formData, 'unverified')
    if (resultado.error) return { error: resultado.error }
    revalidatePath('/', 'layout')
    redirect('/perfil?dos_factores=activada#seguridad')
  } catch (error) {
    unstable_rethrow(error)
    return { error: 'No pudimos confirmar la configuración. Intente de nuevo.' }
  }
}

export async function cancelarConfiguracionDosFactores(formData: FormData): Promise<ResultadoDosFactores> {
  await requireUsuario('/perfil')
  try {
    const parsed = z.uuid().safeParse(formData.get('factorId'))
    if (!parsed.success) return { error: 'Vuelva a cargar la página.' }
    const supabase = await createClient()
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) return { error: 'No pudimos cancelar la configuración. Intente de nuevo.' }
    const factor = data.all.find(f => f.id === parsed.data && f.factor_type === 'totp' && f.status === 'unverified')
    if (!factor) return { error: 'La configuración cambió. Vuelva a cargar la página.' }
    const cancelacion = await supabase.auth.mfa.unenroll({ factorId: factor.id })
    return cancelacion.error ? { error: 'No pudimos cancelar la configuración. Intente de nuevo.' } : {}
  } catch (error) {
    unstable_rethrow(error)
    return { error: 'No pudimos cancelar la configuración. Intente de nuevo.' }
  }
}

export async function desactivarDosFactores(formData: FormData): Promise<ResultadoDosFactores> {
  await requireUsuario('/perfil')
  try {
    // Even an AAL2 session must present a fresh code before removing protection.
    const resultado = await verificarCodigo(formData, 'verified')
    if (resultado.error || !resultado.supabase) return { error: resultado.error }
    const { error } = await resultado.supabase.auth.mfa.unenroll({ factorId: resultado.factorId })
    if (error) return { error: 'No pudimos desactivar el autenticador. Intente de nuevo.' }
    const refresh = await resultado.supabase.auth.refreshSession()
    if (refresh.error) {
      await resultado.supabase.auth.signOut({ scope: 'local' })
      redirect('/login')
    }
    revalidatePath('/', 'layout')
    redirect('/perfil?dos_factores=desactivada#seguridad')
  } catch (error) {
    unstable_rethrow(error)
    return { error: 'No pudimos desactivar el autenticador. Intente de nuevo.' }
  }
}

export async function verificarSegundoFactor(_estado: EstadoForm, formData: FormData): Promise<EstadoForm> {
  try {
    const resultado = await verificarCodigo(formData, 'verified')
    if (resultado.error || !resultado.user) return { error: resultado.error }
    const siguiente = destinoSegundoFactor(formData.get('siguiente'))
    // Invitation acceptance must finish before normal profile/onboarding work.
    if (siguiente.startsWith('/invitacion/admin?')) {
      revalidatePath('/', 'layout')
      redirect(siguiente)
    }
    const admin = createAdmin()
    if (admin) {
      await admin.from('usuarios').update({ ultimo_acceso: new Date().toISOString() }).eq('auth_user_id', resultado.user.id)
    }
    const destino = siguiente === '/restablecer' ? siguiente : await destinoTrasLogin(resultado.user.id, siguiente)
    revalidatePath('/', 'layout')
    redirect(destino)
  } catch (error) {
    unstable_rethrow(error)
    return { error: 'No pudimos verificar el código. Intente de nuevo.' }
  }
}
