import 'server-only'

import { z } from 'zod'
import { requerirRol } from '@/lib/dal'
import { registrarError } from '@/lib/registro-error'
import { fechasAudiencia, resumirAudiencia, type DiaAudiencia, type PeriodoAudiencia, type ValorAudiencia } from '@/lib/audiencia'

const respuestaMetricas = z.object({
  data: z.array(z.object({
    metricName: z.string(), metricType: z.string(), unitType: z.string(),
    value: z.number().finite().nonnegative(),
  })),
  pagination: z.object({ nextPage: z.string().nullable().optional() }).optional(),
})

async function metricasFecha(fecha: string, key: string): Promise<ValorAudiencia[]> {
  const valores: ValorAudiencia[] = []
  for (let pagina = 1; pagina <= 10; pagina++) {
    const params = new URLSearchParams({ date: fecha, limit: '100', page: String(pagina) })
    const response = await fetch(`https://statsigapi.net/console/v1/metrics/values?${params}`, {
      headers: { 'STATSIG-API-KEY': key, 'STATSIG-API-VERSION': '20240601' },
      next: { revalidate: 900 }, signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw Object.assign(new Error('Statsig metrics unavailable'), { status: response.status })
    const resultado = respuestaMetricas.parse(await response.json())
    valores.push(...resultado.data)
    if (!resultado.pagination?.nextPage) return valores
  }
  throw new Error('Statsig metrics pagination limit')
}

export async function estadisticasAdmin(periodo: PeriodoAudiencia) {
  await requerirRol('admin')
  const fechas = fechasAudiencia(periodo)
  const key = process.env.STATSIG_CONSOLE_API_KEY
  const configurado = Boolean(key && process.env.NEXT_PUBLIC_STATSIG_CLIENT_KEY)
  const dias: DiaAudiencia[] = fechas.map(fecha => ({ fecha, valores: null }))
  let errores = 0
  if (configurado) {
    let siguiente = 0
    // Limit bursts against Statsig and bound latency; each response has a timeout.
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (siguiente < dias.length) {
        const dia = dias[siguiente++]
        try { dia.valores = await metricasFecha(dia.fecha, key!) }
        catch (error) { errores++; registrarError('analytics_report_error', error) }
      }
    }))
  }
  return { configurado, errores, desde: fechas[0], hasta: fechas.at(-1)!, periodo,
    ...resumirAudiencia(dias, periodo) }
}
