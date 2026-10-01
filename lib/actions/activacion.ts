'use server'

import { revalidatePath } from 'next/cache'
import { requireUsuario, requerirRol, puedeConsultar } from '@/lib/dal'
import { createAdmin } from '@/lib/supabase/admin'
import { registrarError } from '@/lib/registro-error'
import { procesarAvisosModeracion } from '@/lib/avisos-moderacion'
import type { EstadoForm } from '@/lib/actions/auth'
import { consultaConfirmada } from '@/lib/consulta-confirmada'

export async function registrarPrimeraConsultaAction(confirmacion: string) {
  const usuario = await requireUsuario('/fichas')
  if (!consultaConfirmada(confirmacion, usuario.id) || !usuario.activo || usuario.rol === 'admin' || !(await puedeConsultar(usuario))) return
  try {
    const resultado = await createAdmin({ requestTimeoutMs: 8000 })?.rpc('registrar_primera_consulta', { p_usuario_id: usuario.id })
    if (resultado?.error) throw resultado.error
  } catch (error) { registrarError('activation_search_error', error) }
}

export async function procesarAvisosAction(): Promise<EstadoForm> {
  await requerirRol('admin')
  try {
    const resultado = await procesarAvisosModeracion()
    revalidatePath('/admin/estadisticas')
    if (!resultado.configurado) return { error: 'El correo aún no está configurado. Los avisos permanecen en la cola.' }
    return { mensaje: `${resultado.enviadas} avisos aceptados por el servicio de correo. Los reintentos respetan el plazo de espera de cada aviso.` }
  } catch (error) {
    registrarError('moderation_notification_worker_error', error)
    return { error: 'No pudimos procesar los avisos. La cola se conserva para el próximo intento.' }
  }
}
