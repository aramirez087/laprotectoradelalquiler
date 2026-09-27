import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { destinoInterno } from '@/lib/util'

const TIPOS: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email']

function esTipo(valor: string | null): valor is EmailOtpType {
  return TIPOS.includes(valor as EmailOtpType)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const siguiente = destinoInterno(url.searchParams.get('next'), '/restablecer')
  const supabase = await createClient()
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(siguiente, url.origin))
  } else if (tokenHash && esTipo(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(new URL(siguiente, url.origin))
  }

  return NextResponse.redirect(new URL('/recuperar?error=enlace', url.origin))
}
