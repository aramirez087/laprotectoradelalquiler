import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

function clave() { return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY }

/** Short-lived proof that an authorized server query completed, with no query text. */
export function confirmarConsulta(usuarioId: number, ahora = Date.now()) {
  const key = clave()
  if (!key) return null
  const cuerpo = `${usuarioId}.${ahora}`
  return `${cuerpo}.${createHmac('sha256', key).update(`activacion-consulta:${cuerpo}`).digest('hex')}`
}

export function consultaConfirmada(token: unknown, usuarioId: number, ahora = Date.now()) {
  if (typeof token !== 'string' || !/^\d+\.\d+\.[a-f0-9]{64}$/.test(token)) return false
  const [id, fecha, firma] = token.split('.')
  const tiempo = Number(fecha)
  if (Number(id) !== usuarioId || tiempo > ahora || ahora-tiempo > 10*60_000) return false
  const esperado = confirmarConsulta(usuarioId, tiempo)?.split('.')[2]
  return Boolean(esperado && timingSafeEqual(Buffer.from(firma), Buffer.from(esperado)))
}
