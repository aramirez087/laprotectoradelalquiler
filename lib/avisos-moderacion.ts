import 'server-only'

import { createAdmin } from '@/lib/supabase/admin'
import { registrarError } from '@/lib/registro-error'
import { correoResenasConfigurado, cuerpoCorreo, enviarCuerpoCorreo } from '@/lib/correo-resenas'
import { contenidoAvisoModeracion, type AvisoModeracion } from '@/lib/aviso-moderacion'

/** Service-only worker; callers must validate either an admin session or CRON_SECRET. */
export async function procesarAvisosModeracion() {
  const db = createAdmin({ requestTimeoutMs: 10_000 })
  if (!db) throw new Error('Notification database unavailable')
  const limpieza = await db.rpc('limpiar_datos_activacion')
  if (limpieza.error) throw limpieza.error
  if (!correoResenasConfigurado()) return { configurado: false, enviadas: 0, pendientes: 0, revision: 0 }
  const { data, error } = await db.rpc('reclamar_avisos_moderacion', { p_limite: 3 })
  if (error) throw error
  const resumen = { configurado: true, enviadas: 0, pendientes: 0, revision: 0 }
  for (const aviso of (data ?? []) as AvisoModeracion[]) {
    try {
      const preparado = await db.rpc('preparar_aviso_moderacion', { p_id: aviso.id, p_token: aviso.token,
        p_cuerpo: aviso.cuerpo ?? cuerpoCorreo({ to: aviso.email, contenido: contenidoAvisoModeracion(aviso) }) })
      if (preparado.error) throw preparado.error
      if (!preparado.data) continue // Lease invalidated; do not contact the provider.
      const resultado = await enviarCuerpoCorreo(preparado.data, `moderacion/${aviso.id}`)
      const terminado = await db.rpc('finalizar_aviso_moderacion', { p_id: aviso.id, p_token: aviso.token,
        p_estado: resultado.estado, p_proveedor_id: resultado.proveedorId ?? null })
      if (terminado.error) throw terminado.error
      resumen[resultado.estado === 'enviada' ? 'enviadas' : resultado.estado === 'pendiente' ? 'pendientes' : 'revision']++
    } catch (error) {
      // A failed acknowledgement leaves the lease intact. Recovery uses the same
      // persisted key and payload, within the provider's deduplication window.
      registrarError('moderation_notification_error', error)
      resumen.pendientes++
    }
  }
  return resumen
}

export async function procesarAvisosSinInterrumpir() {
  try { await procesarAvisosModeracion() }
  catch (error) { registrarError('moderation_notification_worker_error', error) }
}
