export type RetornoAuth =
  | { ruta: string }
  | { accessToken: string; refreshToken: string; ruta: '/restablecer' }

/** Older email links can land on Site URL rather than the intended callback. */
export function retornoAuth(href: string): RetornoAuth | null {
  const url = new URL(href)
  if (url.pathname.startsWith('/auth/')) return null
  const fragmento = new URLSearchParams(url.hash.slice(1))
  const recovery = fragmento.get('type') === 'recovery'
  if (recovery && fragmento.get('access_token') && fragmento.get('refresh_token')) {
    return { accessToken: fragmento.get('access_token')!, refreshToken: fragmento.get('refresh_token')!, ruta: '/restablecer' }
  }
  if (fragmento.has('error') || fragmento.has('error_code') || recovery) {
    return { ruta: '/recuperar?error=enlace' }
  }
  if (url.pathname !== '/') return null
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  if (!code && !tokenHash) return null
  const parametros = new URLSearchParams()
  for (const nombre of ['code', 'token_hash', 'type', 'next', 'siguiente', 'sb_flow_id']) {
    const valor = url.searchParams.get(nombre)
    if (valor) parametros.set(nombre, valor)
  }
  return { ruta: `/auth/confirmar?${parametros}` }
}
