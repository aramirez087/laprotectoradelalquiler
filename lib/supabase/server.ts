import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

function clavePublica() {
  // Nueva API keys (sb_publishable_…) o legacy (JWT anon).
  // Es la clave de usuario (sujeta a RLS), no la secret/service_role.
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

export function sinSupabase() {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !clavePublica()
}

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    clavePublica() ?? '',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server Components cannot write cookies; the proxy persists refreshes.
            // Server Actions and Route Handlers can write them here.
          }
        },
      },
    },
  )
}
