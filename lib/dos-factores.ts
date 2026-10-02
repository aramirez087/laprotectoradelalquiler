import type { SupabaseClient, User } from '@supabase/supabase-js'
import { destinoInterno } from '@/lib/util'

export function destinoSegundoFactor(valor: unknown) {
  const destino = destinoInterno(valor, '/')
  return /^\/login(?:[/?#]|$)/.test(destino) ? '/' : destino
}

export function rutaSegundoFactor(siguiente: string) {
  return `/login/verificar?${new URLSearchParams({ siguiente: destinoSegundoFactor(siguiente) })}`
}

/** Read live factors, then validate the signed session, never user metadata. */
export async function requiereSegundoFactor(supabase: SupabaseClient, user: User) {
  if (!user.factors?.some(factor => factor.status === 'verified')) return false
  const { data, error } = await supabase.auth.getClaims()
  if (error || data?.claims.sub !== user.id) throw new Error('No se pudo verificar la sesión.')
  return data.claims.aal !== 'aal2'
}
