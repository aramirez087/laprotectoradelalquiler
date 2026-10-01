import 'server-only'

import * as z from 'zod'
import { requerirRol } from '@/lib/dal'
import { createAdmin } from '@/lib/supabase/admin'
import { registrarError } from '@/lib/registro-error'
import type { PeriodoAudiencia } from '@/lib/audiencia'

const contador = z.number().int().nonnegative()
const Resumen = z.object({ cuentas: contador, enviaron: contador, aprobadas: contador, consultaron: contador,
  maduras: contador, activadas_7d: contador, revisiones: contador, mediana_horas: z.number().nonnegative().nullable(),
  iniciada_en: z.string(), desde: z.string(), hasta: z.string() })
const Avisos = z.object({ pendientes: contador, revision: contador, detalle_revision: z.array(z.object({
  id: z.uuid(), resena_id: contador, accion: z.enum(['aprobada','corregir','rechazada']),
  intentos: contador, creado_en: z.string(), proveedor_id: z.string().nullable(),
})).max(10) })
export type ResumenActivacion = z.infer<typeof Resumen>
export type ResumenAvisos = z.infer<typeof Avisos>

export async function activacionAdmin(periodo: PeriodoAudiencia) {
  const usuario = await requerirRol('admin')
  try {
    const db = createAdmin({ requestTimeoutMs: 8000 })
    if (!db) throw new Error('Activation database unavailable')
    const [activacion, avisos] = await Promise.all([
      db.rpc('resumen_activacion', { p_admin_id: usuario.id, p_dias: periodo }),
      db.rpc('resumen_avisos_moderacion', { p_admin_id: usuario.id }),
    ])
    if (activacion.error) throw activacion.error
    if (avisos.error) throw avisos.error
    return { datos: Resumen.parse(activacion.data), avisos: Avisos.parse(avisos.data) }
  } catch (error) {
    registrarError('activation_report_error', error)
    return null
  }
}
