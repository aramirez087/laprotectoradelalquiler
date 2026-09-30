import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/** Persist refreshes both for this render and for the browser's next request. */
export function createProxyClient(request: NextRequest, requestHeaders: Headers) {
  const refreshed = new NextResponse()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value)
            refreshed.cookies.set(name, value, options)
          }
          requestHeaders.set('cookie', request.headers.get('cookie') ?? '')
          for (const [name, value] of Object.entries(headers)) {
            refreshed.headers.set(name, value)
          }
        },
      },
    },
  )

  return {
    supabase,
    applyCookies(response: NextResponse) {
      for (const cookie of refreshed.cookies.getAll()) response.cookies.set(cookie)
      for (const name of ['cache-control', 'expires', 'pragma']) {
        const value = refreshed.headers.get(name)
        if (value) response.headers.set(name, value)
      }
      return response
    },
  }
}
