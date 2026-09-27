import { NextResponse, type NextRequest } from 'next/server'
import { createClient, sinSupabase } from '@/lib/supabase/server'
import { destinoInterno } from '@/lib/util'

export async function proxy(request: NextRequest) {
  if (sinSupabase()) return NextResponse.next()

  const path = request.nextUrl.pathname
  const protegida =
    path.startsWith('/fichas') ||
    path.startsWith('/resenas') ||
    path.startsWith('/perfil') ||
    path.startsWith('/admin')

  if (protegida) {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      const destino = destinoInterno(path + request.nextUrl.search)
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.search = ''
      url.searchParams.set('siguiente', destino)
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/fichas/:path*', '/resenas/:path*', '/perfil/:path*', '/admin/:path*'],
}
