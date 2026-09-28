import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export function decodificarBase64Url(valor: string) {
  const relleno = valor.length % 4 === 0 ? '' : '='.repeat(4 - (valor.length % 4))
  return Buffer.from(valor.replace(/-/g, '+').replace(/_/g, '/') + relleno, 'base64')
}

/** La firma cubre el payload tal como llega, no el JSON ya decodificado. */
export function leerSolicitudFirmada(
  signedRequest: string,
  secreto: string,
): { user_id: string } | null {
  const partes = signedRequest.split('.')
  if (partes.length !== 2 || !secreto) return null
  const [firmaCodificada, payload] = partes
  if (!firmaCodificada || !payload) return null

  let firma: Buffer
  let esperada: Buffer
  try {
    firma = decodificarBase64Url(firmaCodificada)
    esperada = createHmac('sha256', secreto).update(payload).digest()
  } catch {
    return null
  }
  if (firma.length !== esperada.length || !timingSafeEqual(firma, esperada)) return null

  let datos: unknown
  try {
    datos = JSON.parse(decodificarBase64Url(payload).toString('utf8'))
  } catch {
    return null
  }
  if (!datos || typeof datos !== 'object') return null
  const registro = datos as { algorithm?: unknown; user_id?: unknown }
  if (registro.algorithm !== 'HMAC-SHA256') return null
  if (typeof registro.user_id !== 'string' || registro.user_id.length < 1 || registro.user_id.length > 128) {
    return null
  }
  return { user_id: registro.user_id }
}

export function firmarSolicitudFacebook(userId: string, secreto: string) {
  const payload = Buffer.from(JSON.stringify({ algorithm: 'HMAC-SHA256', user_id: userId })).toString('base64url')
  const firma = createHmac('sha256', secreto).update(payload).digest('base64url')
  return `${firma}.${payload}`
}

export function codigoEliminacion() {
  return randomBytes(16).toString('base64url')
}

export function codigoEliminacionValido(valor: string) {
  return /^[A-Za-z0-9_-]{16,64}$/.test(valor)
}

export function correoEliminado(codigo: string) {
  return `eliminada.${codigo}@cuentas.invalid`
}
