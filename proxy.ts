import { NextResponse, type NextRequest } from 'next/server'
import { altaFacebookLista } from '@/lib/facebook-alta'
import { authFacebookHabilitado, cuentaCreadaConFacebook, esRutaDeAltaFacebook } from '@/lib/facebook-auth'
import { sinSupabase } from '@/lib/supabase/server'
import { createProxyClient } from '@/lib/supabase/proxy'
import { esEntornoIndexable } from '@/lib/seo'
import { destinoInterno } from '@/lib/util'
import { requiereSegundoFactor, rutaSegundoFactor } from '@/lib/dos-factores'

function politicaContenido(nonce: string) {
  const desarrollo = process.env.NODE_ENV === 'development'
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${desarrollo ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "font-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
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

  // Discovery and PWA files must load without auth refresh or onboarding redirects.
  // Keep security/preview headers above, including worker-src for registration.
  if (['/sitemap.xml', '/robots.txt', '/manifest.webmanifest', '/sw.js', '/offline.html'].includes(path) || sinSupabase() || path === '/api/cedula' || path === '/api/errores') return continuar()

  const protegida =
    path.startsWith('/fichas') ||
    path.startsWith('/resenas') ||
    path.startsWith('/perfil') ||
    path.startsWith('/admin') ||
    path.startsWith('/registro/resena')
  const verificando = path === '/login/verificar'
  // Invitations verify their own identity/session and can precede onboarding.
  const vigilarFacebook = !verificando && path !== '/invitacion/admin' && authFacebookHabilitado() && !esRutaDeAltaFacebook(path)
  const { supabase, applyCookies } = createProxyClient(request, requestHeaders)
  const redirigir = (url: URL) => applyCookies(conSeguridad(NextResponse.redirect(url), csp, privada))

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (protegida && !user) return redirigir(urlLogin(request, path))
    if (user && !verificando && (protegida || ['/login', '/restablecer', '/registro/facebook', '/auth/facebook'].includes(path))
      && await requiereSegundoFactor(supabase, user)) {
      const siguiente = path === '/login' ? request.nextUrl.searchParams.get('siguiente') ?? '/' : path + request.nextUrl.search
      return redirigir(new URL(rutaSegundoFactor(siguiente), request.url))
    }

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
