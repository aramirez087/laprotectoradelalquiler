import { timingSafeEqual } from 'node:crypto'
import { procesarAvisosModeracion } from '@/lib/avisos-moderacion'
import { registrarError } from '@/lib/registro-error'

export const maxDuration = 180

/** Protected scheduler endpoint. It never accepts recipients or message content. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  const authorization = request.headers.get('authorization') ?? ''
  const esperada = `Bearer ${secret}`
  const recibido = Buffer.from(authorization)
  const valido = Buffer.from(esperada)
  if (!secret || recibido.length !== valido.length || !timingSafeEqual(recibido, valido)) {
    return new Response(null, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }
  try {
    const resultado = await procesarAvisosModeracion()
    return Response.json(resultado, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    registrarError('moderation_notification_cron_error', error)
    return Response.json({ error: 'No se pudo procesar la cola.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
