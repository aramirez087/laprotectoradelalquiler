import 'server-only'

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { analizarBusqueda } from '@/lib/busqueda-fichas'

type Prueba = { usuario: number; id: string; iniciada: number; tipo: 'nombre' | 'documento'; resultados: boolean; consulta: string; persona: number | null }
const vigencia = 30 * 60_000
function clave() { return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY }
function firma(texto: string) { const key = clave(); return key ? createHmac('sha256', key).update(`resultado-busqueda-v1:${texto}`).digest('base64url') : null }
function consulta(q: string) { return firma(analizarBusqueda(q).valor.toLowerCase())?.slice(0, 22) }
function sellar(prueba: Prueba) {
  const cuerpo = Buffer.from(JSON.stringify([prueba.usuario, prueba.id, prueba.iniciada, prueba.tipo === 'nombre' ? 'n' : 'd', prueba.resultados, prueba.consulta, prueba.persona])).toString('base64url')
  const sello = firma(cuerpo)
  return sello ? `${cuerpo}.${sello}` : null
}

/** Short-lived server proof. Tenant ID exists only in a result link, never a metric. */
export function leerResultadoConfirmado(token: unknown, usuario: number, ahora = Date.now()): Prueba | null {
  if (typeof token !== 'string' || token.length > 400 || !/^[\w-]+\.[\w-]{43}$/.test(token)) return null
  const [cuerpo, sello] = token.split('.')
  const esperado = firma(cuerpo)
  if (!esperado || !timingSafeEqual(Buffer.from(sello), Buffer.from(esperado))) return null
  try {
    const valores: unknown = JSON.parse(Buffer.from(cuerpo, 'base64url').toString())
    if (!Array.isArray(valores) || valores.length !== 7) return null
    const [u, id, fecha, tipo, resultados, q, persona] = valores
    if (u !== usuario || typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)
      || !Number.isSafeInteger(fecha) || fecha > ahora + 5000 || ahora - fecha > vigencia
      || !['n','d'].includes(tipo) || typeof resultados !== 'boolean' || typeof q !== 'string' || !/^[\w-]{22}$/.test(q)
      || (persona !== null && (!Number.isSafeInteger(persona) || persona <= 0 || !resultados))) return null
    return { usuario, id, iniciada: fecha, tipo: tipo === 'n' ? 'nombre' : 'documento', resultados, consulta: q, persona }
  } catch { return null }
}

export function confirmarResultadoBusqueda(usuario: number, q: string, resultados: boolean, anterior?: string, ahora = Date.now()) {
  const busqueda = analizarBusqueda(q)
  const digest = consulta(q)
  if (!digest || (busqueda.tipo !== 'nombre' && busqueda.tipo !== 'documento')) return null
  const previa = leerResultadoConfirmado(anterior, usuario, ahora)
  // A changed query or result outcome starts another journey; pagination/back reuse it.
  if (previa && previa.consulta === digest && previa.resultados === resultados) return sellar({ ...previa, persona: null })
  return sellar({ usuario, id: randomUUID(), iniciada: ahora, tipo: busqueda.tipo, resultados, consulta: digest, persona: null })
}

export function confirmarAperturaFicha(token: string, usuario: number, persona: number, ahora = Date.now()) {
  const prueba = leerResultadoConfirmado(token, usuario, ahora)
  return prueba?.resultados && Number.isSafeInteger(persona) && persona > 0 ? sellar({ ...prueba, persona }) : null
}

export function contextoBusquedaConfirmado(token: string, usuario: number, q: string, persona: number, ahora = Date.now()) {
  const prueba = leerResultadoConfirmado(token, usuario, ahora)
  return prueba?.persona === persona && prueba.consulta === consulta(q) ? sellar({ ...prueba, persona: null }) : null
}
