import { NextResponse, type NextRequest } from 'next/server'
import { altaFacebookLista } from '@/lib/facebook-alta'
import { authFacebookHabilitado, cuentaCreadaConFacebook, esRutaDeAltaFacebook } from '@/lib/facebook-auth'
import { sinSupabase } from '@/lib/supabase/server'
import { createProxyClient } from '@/lib/supabase/proxy'
import { esEntornoIndexable } from '@/lib/seo'
import { destinoInterno } from '@/lib/util'

function politicaContenido(nonce: string) {
  const desarrollo = process.env.NODE_ENV === 'development'
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${desarrollo ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.statsig.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    desarrollo ? '' : 'upgrade-insecure-requests',
  ]
    .filter(Boolean)
    .join('; ')
}

function rutaPrivada(path: string) {
  return [
    '/admin',
    '/auth',
    '/fichas',
    '/invitacion',
    '/login',
    '/perfil',
    '/recuperar',
    '/registro',
    '/resenas',
    '/restablecer',
    '/ux-resenas-preview',
  ].some((ruta) => path === ruta || path.startsWith(`${ruta}/`))
}

function conSeguridad(response: NextResponse, csp: string, privada: boolean) {
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (privada) response.headers.set('X-Robots-Tag', 'noindex, nofollow, nosnippet, noimageindex')
  return response
}

function urlLogin(request: NextRequest, path: string) {
  const url = request.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  url.searchParams.set('siguiente', destinoInterno(path + request.nextUrl.search))
  return url
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  const privada = rutaPrivada(path) || !esEntornoIndexable()
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = politicaContenido(nonce)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)
  const continuar = () =>
    conSeguridad(NextResponse.next({ request: { headers: requestHeaders } }), csp, privada)

  // Discovery files are public for every session and must not depend on auth refresh
  // or an incomplete Facebook registration. Keep security/preview headers above.
  if (path === '/sitemap.xml' || path === '/robots.txt' || sinSupabase() || path === '/api/cedula' || path === '/api/errores') return continuar()

  const protegida =
    path.startsWith('/fichas') ||
    path.startsWith('/resenas') ||
    path.startsWith('/perfil') ||
    path.startsWith('/admin') ||
    path.startsWith('/registro/resena')
  const vigilarFacebook = authFacebookHabilitado() && !esRutaDeAltaFacebook(path)
  const { supabase, applyCookies } = createProxyClient(request, requestHeaders)
  const redirigir = (url: URL) => applyCookies(conSeguridad(NextResponse.redirect(url), csp, privada))

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (protegida && !user) return redirigir(urlLogin(request, path))

    if (vigilarFacebook && user && cuentaCreadaConFacebook(user) && !(await altaFacebookLista(user.id))) {
      const url = request.nextUrl.clone()
      url.pathname = '/registro/facebook'
      url.search = ''
      url.searchParams.set('siguiente', destinoInterno(path + request.nextUrl.search))
      return redirigir(url)
    }
  } catch {
    if (protegida) return redirigir(urlLogin(request, path))
  }

  return applyCookies(continuar())
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
