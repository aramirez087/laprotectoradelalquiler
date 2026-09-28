import { esCedulaValida, normalizarPerfilFacebook } from '@/lib/util'

/** La pantalla de alta solo aparece con AUTH_FACEBOOK=1, después de Meta y Supabase. */
export function authFacebookHabilitado(valor = process.env.AUTH_FACEBOOK) {
  return valor === '1'
}

export function cuentaCreadaConFacebook(
  user: { app_metadata?: { provider?: string } | null } | null | undefined,
) {
  return user?.app_metadata?.provider === 'facebook'
}

export function tieneIdentidadFacebook(
  user:
    | {
        app_metadata?: { provider?: string; providers?: string[] } | null
        identities?: { provider?: string }[] | null
      }
    | null
    | undefined,
) {
  if (!user) return false
  if (user.app_metadata?.provider === 'facebook') return true
  if (user.app_metadata?.providers?.includes('facebook')) return true
  return user.identities?.some((identidad) => identidad.provider === 'facebook') ?? false
}

/** Cédula válida y enlace público. El id de Facebook no sustituye ese enlace. */
export function altaLista(identificacion: string | null | undefined, facebook: string | null | undefined) {
  return esCedulaValida(identificacion) && Boolean(normalizarPerfilFacebook(facebook))
}

export function nombreDesdeFacebook(meta: Record<string, unknown> | null | undefined) {
  for (const clave of ['full_name', 'name', 'nombre']) {
    const valor = meta?.[clave]
    if (typeof valor === 'string' && valor.trim().length >= 3) return valor.trim()
  }
  return ''
}

export function esErrorDeCorreoOcupado(texto: string) {
  return /already|registered|exists|duplicate/i.test(texto)
}

export const RUTA_ALTA_FACEBOOK = '/registro/facebook'

export function esRutaDeAltaFacebook(path: string) {
  return path === RUTA_ALTA_FACEBOOK || path.startsWith('/auth/facebook') || path === '/auth/confirmar'
}

export function rutaAltaFacebook(siguiente: string) {
  return `${RUTA_ALTA_FACEBOOK}?${new URLSearchParams({ siguiente })}`
}

export function rutaEntrarConFacebook(siguiente: string) {
  return `/auth/facebook?${new URLSearchParams({ siguiente })}`
}

export const RUTA_VINCULAR_FACEBOOK = '/auth/facebook?modo=vincular'

export function destinoTrasEntrarConFacebook(siguiente: string, lista: boolean) {
  return lista ? siguiente : rutaAltaFacebook(siguiente)
}

export function rutaTrasFalloFacebook(descripcion: string, modo: 'entrar' | 'vincular', siguiente: string) {
  if (modo === 'vincular') return '/perfil?error=facebook'
  const error = esErrorDeCorreoOcupado(descripcion) ? 'facebook-correo' : 'facebook'
  return `/login?${new URLSearchParams({ error, siguiente })}`
}

const MENSAJES_FACEBOOK = {
  facebook: 'No pudimos entrar con Facebook. Intente de nuevo.',
  'facebook-correo':
    'Ese correo ya tiene cuenta. Inicie sesión con su clave y, desde su perfil, conecte Facebook.',
} as const

/** Null mientras el ingreso con Facebook está apagado, aunque la URL traiga el código. */
export function mensajeErrorFacebook(codigo: string | undefined, habilitado: boolean) {
  if (!habilitado) return null
  if (codigo === 'facebook' || codigo === 'facebook-correo') return MENSAJES_FACEBOOK[codigo]
  return null
}

export function origenPublico(request: Request) {
  const url = new URL(request.url)
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host)
    .split(',')[0]
    .trim()
  const protoHeader = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const proto = protoHeader ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https')
  return `${proto}://${host}`
}
