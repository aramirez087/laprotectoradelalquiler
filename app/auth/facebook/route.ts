import { NextResponse } from 'next/server'
import { authFacebookHabilitado, origenPublico, rutaTrasFalloFacebook } from '@/lib/facebook-auth'
import { createClient, sinSupabase } from '@/lib/supabase/server'
import { destinoInterno } from '@/lib/util'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const siguiente = destinoInterno(url.searchParams.get('siguiente'))
  const vincular = url.searchParams.get('modo') === 'vincular'
  const origen = origenPublico(request)

  if (!authFacebookHabilitado() || sinSupabase()) {
    const destino = vincular ? '/perfil' : `/login?${new URLSearchParams({ siguiente })}`
    return NextResponse.redirect(new URL(destino, origen))
  }

  const retorno = new URL('/auth/facebook/retorno', origen)
  retorno.searchParams.set('next', vincular ? '/perfil' : siguiente)
  if (vincular) retorno.searchParams.set('modo', 'vincular')

  const supabase = await createClient()
  if (vincular) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(new URL(`/login?${new URLSearchParams({ siguiente: '/perfil' })}`, origen))
    }
  }

  const credenciales = {
    provider: 'facebook' as const,
    options: {
      redirectTo: retorno.toString(),
      skipBrowserRedirect: true,
    },
  }
  const { data, error } = vincular
    ? await supabase.auth.linkIdentity(credenciales)
    : await supabase.auth.signInWithOAuth(credenciales)

  if (error || !data.url) {
    return NextResponse.redirect(new URL(rutaTrasFalloFacebook(error?.message ?? '', vincular ? 'vincular' : 'entrar', siguiente), origen))
  }
  return NextResponse.redirect(data.url)
}
