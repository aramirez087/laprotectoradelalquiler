import { createReadStream } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { gzipSync } from 'node:zlib'

const decoder = new TextDecoder('windows-1252')
export const URL_PADRON = 'https://www.tse.go.cr/zip/padron/padron_completo.zip'
export const URL_FECHA = 'https://www.tse.go.cr/descarga_padron.html'

export function fechaPublicada(html) {
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  const texto = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  const match = texto.match(/actualizado al\s+(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(?:de\s+)?(\d{4})/i)
  if (!match) throw new Error('No se pudo determinar la fecha oficial del padrón.')
  const mes = meses.indexOf(match[2].toLowerCase().replace('setiembre', 'septiembre')) + 1
  const fecha = `${match[3]}-${String(mes).padStart(2, '0')}-${match[1].padStart(2, '0')}`
  if (!mes || new Date(`${fecha}T00:00:00Z`).toISOString().slice(0, 10) !== fecha) throw new Error('Fecha del padrón inválida.')
  return fecha
}

export function leerElector(linea) {
  const campos = linea.replace(/\r$/, '').split(',').map(c => c.trim())
  if (campos.length !== 8 || !/^[1-9]\d{8}$/.test(campos[0]) || !campos[5] || !campos[6]
    || campos.slice(5).some(c => c.length > 100 || /[\t\n\r\u0000-\u001f\ufffd]/u.test(c))) {
    throw new Error('El formato del padrón cambió o contiene registros inválidos.')
  }
  return [campos[0], ...campos.slice(5)].join('\t')
}

export async function hashArchivo(archivo) {
  const hash = createHash('sha256')
  for await (const parte of createReadStream(archivo)) hash.update(parte)
  return hash.digest('hex')
}

export async function prepararFragmentos(archivoZip, destino) {
  const proceso = spawn('unzip', ['-p', archivoZip, 'PADRON_COMPLETO.txt'], { stdio: ['ignore', 'pipe', 'ignore'] })
  const fin = new Promise((resolve, reject) => {
    proceso.on('error', reject)
    proceso.on('close', code => code === 0 ? resolve() : reject(new Error('No se pudo leer PADRON_COMPLETO.txt del ZIP.')))
  })
  // Manejar también errores del proceso durante la lectura del stream.
  fin.catch(() => {})
  proceso.stdout.setEncoding('latin1')
  const lector = createInterface({ input: proceso.stdout, crlfDelay: Infinity })
  const prefijos = []
  let registros = 0, anterior = '', prefijo = '', lineas = []
  async function guardar() {
    if (!prefijo) return
    const texto = lineas.join('\n') + '\n'
    if (Buffer.byteLength(texto) > 8 * 1024 * 1024) throw new Error('El fragmento del padrón excede el límite esperado.')
    await writeFile(`${destino}/${prefijo}.txt.gz`, gzipSync(texto, { level: 9 }))
    prefijos.push(prefijo)
    lineas = []
  }
  try {
    for await (const cruda of lector) {
      if (!cruda.trim()) continue
      const linea = leerElector(decoder.decode(Buffer.from(cruda, 'latin1')))
      const cedula = linea.slice(0, 9)
      if (cedula <= anterior) throw new Error('El padrón contiene duplicados o cambió su orden. Se conserva la versión anterior.')
      anterior = cedula
      const siguiente = cedula.slice(0, 3)
      if (siguiente !== prefijo) { await guardar(); prefijo = siguiente }
      lineas.push(linea)
      registros++
    }
    await fin
    await guardar()
    if (registros < 3_000_000) throw new Error('La descarga no contiene el padrón completo. Se conserva la versión anterior.')
    return { prefijos, registros }
  } catch (error) {
    lector.close()
    proceso.kill()
    throw error
  }
}

export async function subirFragmentos(storage, version, prefijos, directorio) {
  let siguiente = 0
  let fallo
  // Concurrencia acotada; no cargar el padrón completo en memoria.
  await Promise.all(Array.from({ length: 4 }, async () => {
    try {
      while (!fallo && siguiente < prefijos.length) {
        const prefijo = prefijos[siguiente++]
        const datos = await readFile(`${directorio}/${prefijo}.txt.gz`)
        const { error } = await storage.upload(`${version}/${prefijo}.txt.gz`, datos, { contentType: 'application/gzip', upsert: true, cacheControl: '31536000' })
        if (error) throw new Error(`No se pudo subir el fragmento ${prefijo}: ${error.message}`)
      }
    } catch (error) {
      fallo ??= error
    }
  }))
  if (fallo) throw fallo
}
