import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { altaFacebookLista, vincularCuentaListaPorCorreo } from '@/lib/facebook-alta'
import {
  authFacebookHabilitado,
  cuentaCreadaConFacebook,
  destinoTrasEntrarConFacebook,
  rutaTrasFalloFacebook,
} from '@/lib/facebook-auth'
import { createClient } from '@/lib/supabase/server'
import { destinoInterno } from '@/lib/util'
import { requiereSegundoFactor, rutaSegundoFactor } from '@/lib/dos-factores'

const TIPOS: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email']

function esTipo(valor: string | null): valor is EmailOtpType {
  return TIPOS.includes(valor as EmailOtpType)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const origenFacebook = url.searchParams.get('origen') === 'facebook'
  const modo = url.searchParams.get('modo') === 'vincular' ? 'vincular' : 'entrar'
  const type = url.searchParams.get('type')
  const siguiente = destinoInterno(url.searchParams.get('next'), type === 'signup' || type === 'email' ? '/registro/resena' : origenFacebook || type ? '/' : '/restablecer')
  const destinoRecuperacion = () => {
    const continuar = destinoInterno(url.searchParams.get('siguiente'), '/')
    return `/restablecer${continuar === '/' ? '' : `?${new URLSearchParams({ siguiente: continuar })}`}`
  }
  const base = url.origin
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const descripcion = url.searchParams.get('error_description') ?? url.searchParams.get('error') ?? ''

  const redirigir = (ruta: string) => {
    const response = NextResponse.redirect(new URL(ruta, base))
    response.headers.set('Cache-Control', 'private, no-store, max-age=0')
    response.headers.set('Referrer-Policy', 'no-referrer')
    return response
  }

  if (origenFacebook && !authFacebookHabilitado()) {
    return redirigir('/login')
  }
  if (origenFacebook && descripcion) {
    return redirigir(rutaTrasFalloFacebook(descripcion, modo, siguiente))
  }

  try {
    const supabase = await createClient()
    if (code) {
      const flowId = url.searchParams.get('sb_flow_id')
      const { data, error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined)
      if (!error) {
        // Auth JS returns redirectType at runtime; its public return type omits it.
        const recuperacion = ('redirectType' in data && data.redirectType === 'recovery') || type === 'recovery'
        const destino = recuperacion ? destinoRecuperacion() : siguiente
        const cuenta = data.user ?? (await supabase.auth.getUser()).data.user
        if (cuenta && await requiereSegundoFactor(supabase, cuenta)) {
          return redirigir(rutaSegundoFactor(destino))
        }
        if (origenFacebook && modo === 'entrar') {
          const user = data.user ?? (await supabase.auth.getUser()).data.user
          if (user && cuentaCreadaConFacebook(user)) {
            const lista =
              (await vincularCuentaListaPorCorreo(user.id, user.email)) || (await altaFacebookLista(user.id))
            return redirigir(destinoTrasEntrarConFacebook(siguiente, lista))
          }
        }
        if (origenFacebook && modo === 'vincular') {
          return redirigir('/perfil?facebook=conectado')
        }
        return redirigir(destino)
      }
    } else if (tokenHash && esTipo(type)) {
      const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      if (!error) {
        const user = data?.user ?? (await supabase.auth.getUser()).data.user
        const destino = type === 'recovery' ? destinoRecuperacion() : siguiente
        return redirigir(user && await requiereSegundoFactor(supabase, user) ? rutaSegundoFactor(destino) : destino)
      }
    }
  } catch {
    // The link or Auth service may fail; offer another link without leaking tokens.
  }

  if (origenFacebook) return redirigir(rutaTrasFalloFacebook('', modo, siguiente))
  const confirmacion = type !== 'recovery' && (type === 'signup' || type === 'email' || siguiente === '/registro/resena')
  const parametros = new URLSearchParams({ error: confirmacion ? 'confirmacion' : 'enlace' })
  const continuar = destinoInterno(url.searchParams.get('siguiente'), '/')
  if (continuar !== '/') parametros.set('siguiente', continuar)
  return redirigir(`${confirmacion ? '/login' : '/recuperar'}?${parametros}`)
}
