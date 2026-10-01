import 'server-only'

import * as z from 'zod'
import { requerirRol } from '@/lib/dal'
import { createAdmin } from '@/lib/supabase/admin'
import { registrarError } from '@/lib/registro-error'
import type { PeriodoAudiencia } from '@/lib/audiencia'

const contador = z.number().int().nonnegative()
const Resumen = z.object({ busquedas: contador, sin_resultados: contador, con_resultados: contador, con_apertura: contador,
  miembros: contador, miembros_con_apertura: contador, miembros_recurrentes: contador, documentos: contador, nombres: contador,
  desde: z.string(), hasta: z.string(), iniciada_en: z.string() })
export type ResumenResultadosBusqueda = z.infer<typeof Resumen>

export async function resultadosBusquedaAdmin(periodo: PeriodoAudiencia) {
  const usuario = await requerirRol('admin')
  try {
    const db = createAdmin({ requestTimeoutMs: 8000 })
    if (!db) throw new Error('Search metrics database unavailable')
    const respuesta = await db.rpc('resumen_resultados_busqueda', { p_admin_id: usuario.id, p_dias: periodo })
    if (respuesta.error) throw respuesta.error
    return Resumen.parse(respuesta.data)
  } catch (error) { registrarError('search_outcome_report_error', error); return null }
}
