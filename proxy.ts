import { NextResponse, type NextRequest } from 'next/server'
import { altaFacebookLista } from '@/lib/facebook-alta'
import { authFacebookHabilitado, cuentaCreadaConFacebook, esRutaDeAltaFacebook } from '@/lib/facebook-auth'
import { createClient, sinSupabase } from '@/lib/supabase/server'
import { destinoInterno } from '@/lib/util'

export async function proxy(request: NextRequest) {
  if (sinSupabase()) return NextResponse.next()

  const path = request.nextUrl.pathname
  const protegida =
    path.startsWith('/fichas') ||
    path.startsWith('/resenas') ||
    path.startsWith('/perfil') ||
    path.startsWith('/admin') ||
    path.startsWith('/registro/resena')
  const vigilarFacebook = authFacebookHabilitado() && !esRutaDeAltaFacebook(path)
  if (!protegida && !vigilarFacebook) return NextResponse.next()

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (protegida && !session) {
    const destino = destinoInterno(path + request.nextUrl.search)
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('siguiente', destino)
    return NextResponse.redirect(url)
  }

  if (vigilarFacebook && session && cuentaCreadaConFacebook(session.user)) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!protegida) return NextResponse.next()
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.search = ''
        url.searchParams.set('siguiente', destinoInterno(path + request.nextUrl.search))
        return NextResponse.redirect(url)
      }
      if (cuentaCreadaConFacebook(user) && !(await altaFacebookLista(user.id))) {
        const destino = destinoInterno(path + request.nextUrl.search)
        const url = request.nextUrl.clone()
        url.pathname = '/registro/facebook'
        url.search = ''
        url.searchParams.set('siguiente', destino)
        return NextResponse.redirect(url)
      }
    } catch {
      return NextResponse.next()
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/registro/:path*',
    '/fichas/:path*',
    '/resenas/:path*',
    '/perfil/:path*',
    '/admin/:path*',
  ],
}
