import { normalizarPerfilFacebook } from '@/lib/util'

/** Solo decide cómo mostrar el dato guardado; nunca valida el registro. */
export function enlaceFacebook(valor: string): string | null {
  const texto = valor.trim()
  if (!texto || /[\s<>\p{Cc}]/u.test(texto)) return null

  try {
    const url = new URL(/^https?:\/\//i.test(texto) ? texto : `https://${texto.replace(/^\/+/, '')}`)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (
      !url.username && !url.password &&
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      ['facebook.com', 'm.facebook.com', 'web.facebook.com', 'fb.com', 'm.fb.com'].includes(host)
    ) return url.href
  } catch {
    // Un nombre de usuario también puede mostrarse como enlace.
  }

  const usuario = texto.replace(/^@/, '')
  return /^[A-Za-z0-9.]+$/.test(usuario) ? normalizarPerfilFacebook(usuario) : null
}
