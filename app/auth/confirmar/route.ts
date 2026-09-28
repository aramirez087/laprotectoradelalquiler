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

const TIPOS: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email']

function esTipo(valor: string | null): valor is EmailOtpType {
  return TIPOS.includes(valor as EmailOtpType)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const origenFacebook = url.searchParams.get('origen') === 'facebook'
  const modo = url.searchParams.get('modo') === 'vincular' ? 'vincular' : 'entrar'
  const siguiente = destinoInterno(url.searchParams.get('next'), origenFacebook ? '/fichas' : '/restablecer')
  const base = url.origin
  const supabase = await createClient()
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')
  const descripcion = url.searchParams.get('error_description') ?? url.searchParams.get('error') ?? ''

  if (origenFacebook && !authFacebookHabilitado()) {
    return NextResponse.redirect(new URL('/login', base))
  }
  if (origenFacebook && descripcion) {
    return NextResponse.redirect(new URL(rutaTrasFalloFacebook(descripcion, modo, siguiente), base))
  }

  if (code) {
    const flowId = url.searchParams.get('sb_flow_id')
    const { data, error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined)
    if (!error) {
      if (origenFacebook && modo === 'entrar') {
        const user = data.user ?? (await supabase.auth.getUser()).data.user
        if (user && cuentaCreadaConFacebook(user)) {
          const lista =
            (await vincularCuentaListaPorCorreo(user.id, user.email)) || (await altaFacebookLista(user.id))
          return NextResponse.redirect(new URL(destinoTrasEntrarConFacebook(siguiente, lista), base))
        }
      }
      if (origenFacebook && modo === 'vincular') {
        return NextResponse.redirect(new URL('/perfil?facebook=conectado', base))
      }
      return NextResponse.redirect(new URL(siguiente, base))
    }
  } else if (tokenHash && esTipo(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(new URL(siguiente, base))
  }

  const fallo = origenFacebook ? rutaTrasFalloFacebook('', modo, siguiente) : '/recuperar?error=enlace'
  return NextResponse.redirect(new URL(fallo, base))
}
