import { createClient as createSupabase } from '@supabase/supabase-js'

/**
 * Cliente privilegiado (bypass RLS): solo para operaciones de
 * administración en el servidor. Nunca lo use en código de cliente.
 * Nueva API key (sb_secret_…) o legacy (JWT service_role).
 */
export function createAdmin() {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null
  return createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL, key)
}
