import 'server-only'

import { cache } from 'react'
import { gunzip } from 'node:zlib'
import { promisify } from 'node:util'
import { createAdmin } from '@/lib/supabase/admin'
import { registrarError } from '@/lib/registro-error'
import { buscarEnFragmento, cedulaNacional, PADRON_BUCKET, padronVigente, type ResultadoCedula } from '@/lib/cedula'

const descomprimir = promisify(gunzip)
// Versiones inmutables. Caché acotada por instancia y manifiesto público por 30 s.
const fragmentos = new Map<string, Promise<string[]>>()
type Manifiesto = { version: string; fecha_padron: string; prefijos: string[] }
let ultimoManifiesto: { vence: number; tarea: Promise<Manifiesto | null> } | undefined

async function leerManifiesto(): Promise<Manifiesto | null> {
  const db = createAdmin({ requestTimeoutMs: 6000 })
  if (!db) return null
  const { data, error } = await db.from('padron_tse').select('version, fecha_padron, prefijos').eq('id', 1).maybeSingle()
  if (error) {
    registrarError('padron_manifest_error', error)
    return null
  }
  if (!data || !/^\d{4}-\d{2}-\d{2}-[a-f0-9]{16}$/.test(data.version)
    || !Array.isArray(data.prefijos) || !data.prefijos.every((p: unknown) => typeof p === 'string' && /^[1-9]\d{2}$/.test(p))) return null
  return data as Manifiesto
}

const manifiesto = cache(async () => {
  if (ultimoManifiesto && ultimoManifiesto.vence > Date.now()) return ultimoManifiesto.tarea
  const tarea = leerManifiesto()
  ultimoManifiesto = { vence: Date.now() + 30_000, tarea }
  try {
    const datos = await tarea
    // Do not retain outages; the next request can recover immediately.
    if (!datos && ultimoManifiesto?.tarea === tarea) ultimoManifiesto = undefined
    return datos
  } catch (error) {
    if (ultimoManifiesto?.tarea === tarea) ultimoManifiesto = undefined
    throw error
  }
})

async function cargarFragmento(version: string, prefijo: string) {
  const clave = `${version}/${prefijo}.txt.gz`
  const existente = fragmentos.get(clave)
  if (existente) return existente
  const tarea = (async () => {
    const db = createAdmin({ requestTimeoutMs: 6000 })
    if (!db) throw new Error('Padrón no disponible.')
    const { data, error } = await db.storage.from(PADRON_BUCKET).download(clave)
    if (error || !data) throw new Error('No se pudo consultar el padrón.')
    const texto = (await descomprimir(Buffer.from(await data.arrayBuffer()), { maxOutputLength: 8 * 1024 * 1024 })).toString('utf8')
    const lineas = texto.split('\n')
    if (lineas.at(-1) === '') lineas.pop()
    let anterior = ''
    for (const linea of lineas) {
      const campos = linea.split('\t')
      if (campos.length !== 4 || !cedulaNacional(campos[0]) || !campos[0].startsWith(prefijo)
        || campos[0] <= anterior || !campos[1] || !campos[2]) throw new Error('Padrón incompleto o inválido.')
      anterior = campos[0]
    }
    return lineas
  })()
  fragmentos.set(clave, tarea)
  if (fragmentos.size > 8) fragmentos.delete(fragmentos.keys().next().value!)
  try { return await tarea } catch (error) {
    if (fragmentos.get(clave) === tarea) fragmentos.delete(clave)
    throw error
  }
}

export const consultarCedula = cache(async (valor: string | null | undefined, guardarResultado = false): Promise<ResultadoCedula> => {
  const cedula = cedulaNacional(valor)
  if (!cedula) return { estado: 'no_aplica' }
  try {
    const datos = await manifiesto()
    if (!datos) return { estado: 'no_disponible' }
    const fechaPadron = datos.fecha_padron
    if (!padronVigente(fechaPadron)) return { estado: 'desactualizado', fechaPadron }
    const prefijo = cedula.slice(0, 3)
    const persona = datos.prefijos.includes(prefijo)
      ? buscarEnFragmento(await cargarFragmento(datos.version, prefijo), cedula) : null
    if (guardarResultado) {
      const db = createAdmin({ requestTimeoutMs: 6000 })
      if (!db) throw new Error('No se pudo guardar la verificación.')
      const { error } = await db.rpc('guardar_verificacion_cedula', {
        p_identificacion: cedula, p_fecha_padron: fechaPadron,
        p_nombre_tse: persona?.nombreCompleto ?? null,
      })
      if (error) throw error
    }
    return persona ? { estado: 'encontrada', fechaPadron, persona } : { estado: 'no_encontrada', fechaPadron }
  } catch (error) {
    registrarError('padron_lookup_error', error)
    return { estado: 'no_disponible' }
  }
})
