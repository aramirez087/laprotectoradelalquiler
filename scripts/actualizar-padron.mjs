// Descargar, validar y publicar el índice privado sin tocar las cuentas ni las fichas.
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createClient } from '@supabase/supabase-js'
import { fechaPublicada, hashArchivo, prepararFragmentos, subirFragmentos, URL_FECHA, URL_PADRON } from './padron-tse.mjs'

const argumentos = process.argv.slice(2)
const archivoLocal = argumentos.find(a => a.startsWith('--archivo='))?.slice(10)
const fechaLocal = argumentos.find(a => a.startsWith('--fecha='))?.slice(8)
if (argumentos.length && (argumentos.length !== 2 || !archivoLocal || !fechaLocal
  || !/^\d{4}-\d{2}-\d{2}$/.test(fechaLocal)
  || new Date(`${fechaLocal}T00:00:00Z`).toISOString().slice(0, 10) !== fechaLocal)) {
  throw new Error('Use sin argumentos para descargar del TSE, o --archivo=/ruta/padron.zip --fecha=AAAA-MM-DD para un ZIP oficial ya descargado.')
}
for (const f of ['.env.local', '.env']) {
  try { process.loadEnvFile(new URL(`../${f}`, import.meta.url)) } catch { /* opcional */ }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Falta la configuración de servicio de Supabase.')
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init = {}) => fetch(input, { ...init, signal: AbortSignal.timeout(120_000) }) },
})

async function obtenerFecha() {
  const respuesta = await fetch(URL_FECHA, { signal: AbortSignal.timeout(30_000) })
  if (!respuesta.ok) throw new Error('No se pudo leer la fecha oficial del TSE.')
  return fechaPublicada(await respuesta.text())
}

const temporal = await mkdtemp(join(tmpdir(), 'laprotectora-padron-'))
try {
  const fecha = fechaLocal ?? await obtenerFecha()
  const vigente = await db.from('padron_tse').select('fecha_padron, version').eq('id', 1).maybeSingle()
  if (vigente.error) throw new Error('Primero aplique la migración de verificación de cédulas.')
  if (vigente.data?.fecha_padron >= fecha) {
    console.log(`El padrón del ${vigente.data.fecha_padron} ya está publicado.`)
  } else {
    const archivo = archivoLocal ?? join(temporal, 'padron.zip')
    if (!archivoLocal) {
      console.log(`Descargando el padrón oficial del ${fecha}…`)
      const respuesta = await fetch(URL_PADRON, { signal: AbortSignal.timeout(300_000) })
      if (!respuesta.ok || !respuesta.body) throw new Error('No se pudo descargar el padrón del TSE.')
      await pipeline(Readable.fromWeb(respuesta.body), createWriteStream(archivo))
    }
    const bytes = (await stat(archivo)).size
    if (bytes < 10_000_000 || bytes > 200_000_000) throw new Error('El tamaño de la descarga no corresponde al padrón completo.')
    const sha256 = await hashArchivo(archivo)
    const version = `${fecha}-${sha256.slice(0, 16)}`
    const { prefijos, registros } = await prepararFragmentos(archivo, temporal)
    const bucket = await db.storage.getBucket('padron-tse')
    if (bucket.error) {
      const crear = await db.storage.createBucket('padron-tse', { public: false, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: ['application/gzip'] })
      if (crear.error) throw new Error('No se pudo crear el bucket privado del padrón.')
    } else if (bucket.data.public) throw new Error('El bucket del padrón debe ser privado.')
    console.log(`Validado: ${registros.toLocaleString('es-CR')} electores; ${prefijos.length} fragmentos. Publicando…`)
    await subirFragmentos(db.storage.from('padron-tse'), version, prefijos, temporal)
    // El manifiesto se publica únicamente después de subir y validar todos los fragmentos.
    const publicado = await db.rpc('publicar_padron_tse', {
      p_version: version, p_fecha: fecha, p_prefijos: prefijos, p_registros: registros, p_sha256: sha256,
    })
    if (publicado.error || publicado.data !== true) throw new Error('No se pudo publicar el manifiesto; la versión anterior sigue activa.')
    console.log(`✓ Padrón del ${fecha} publicado. Cuentas y reseñas conservadas.`)
    // Conservar la versión activa, la anterior y cualquier carga de los últimos siete días.
    const versiones = await db.storage.from('padron-tse').list('', { limit: 1000, sortBy: { column: 'name', order: 'desc' } })
    const manifiesto = await db.from('padron_tse').select('version').eq('id', 1).single()
    if (!versiones.error && !manifiesto.error) {
      const carpetas = versiones.data.filter(v => /^\d{4}-\d{2}-\d{2}-[a-f0-9]{16}$/.test(v.name))
      const conservar = new Set([manifiesto.data.version, vigente.data?.version, ...carpetas.slice(0, 2).map(v => v.name)])
      for (const carpeta of carpetas) {
        if (conservar.has(carpeta.name) || Date.now() - Date.parse(carpeta.name.slice(0, 10)) < 7 * 86_400_000) continue
        const archivos = await db.storage.from('padron-tse').list(carpeta.name, { limit: 1000 })
        if (!archivos.error && archivos.data.length) {
          if (archivos.data.some(a => Date.now() - Date.parse(a.updated_at ?? a.created_at) < 7 * 86_400_000)) continue
          const borrado = await db.storage.from('padron-tse').remove(archivos.data.map(a => `${carpeta.name}/${a.name}`))
          if (borrado.error) console.warn('No se pudo limpiar una versión anterior; la publicación sigue vigente.')
        }
      }
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'No se pudo actualizar el padrón.')
  process.exitCode = 1
} finally {
  await rm(temporal, { recursive: true, force: true })
}
