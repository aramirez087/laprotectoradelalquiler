import { createBrowserClient } from '@supabase/ssr'

function clavePublica() {
  // Nueva API keys (sb_publishable_…) o legacy (JWT anon)
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

export function createClient(options?: { detectSessionInUrl?: boolean }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = clavePublica()
  if (!url || !key) {
    return null
  }
  return createBrowserClient(url, key, options ? { auth: options, isSingleton: false } : undefined)
}
