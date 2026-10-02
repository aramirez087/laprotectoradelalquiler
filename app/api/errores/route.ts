import { registrarError } from '@/lib/registro-error'
import { esOrigenPropio } from '@/lib/origen'
import { rutaDiagnostico } from '@/lib/ruta-diagnostico'
import { categoriasErrorCliente, eventosErrorCliente, fuentesErrorCliente } from '@/lib/diagnostico-error-cliente'

let ventana = 0
let recibidos = 0
const nombres = new Set(['Error', 'TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'AbortError', 'TimeoutError'])

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }
  if (!esOrigenPropio(request)) return new Response(null, { status: 403, headers })
  if (!request.headers.get('content-type')?.startsWith('application/json')) return new Response(null, { status: 415, headers })
  if (Number(request.headers.get('content-length') ?? 0) > 1024) return new Response(null, { status: 413, headers })
  if (Date.now() - ventana > 60_000) { ventana = Date.now(); recibidos = 0 }
  if (++recibidos > 60) return new Response(null, { status: 429, headers })
  // Read only a small bounded body, even when Content-Length is missing.
  const reader = request.body?.getReader()
  if (!reader) return new Response(null, { status: 400, headers })
  try {
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 1024) { await reader.cancel(); return new Response(null, { status: 413, headers }) }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    const datos = JSON.parse(new TextDecoder().decode(bytes))
    const diagnostico = datos?.diagnostico
    if (!['limite', 'navegador', 'accion'].includes(datos?.origen) || !nombres.has(datos?.nombre)
      || (datos.digest !== undefined && (typeof datos.digest !== 'string' || !/^\d{1,20}(?:@E\d{1,8})?$/.test(datos.digest)))
      || (datos.ruta !== undefined && !rutaDiagnostico(datos.ruta))
      || (datos.frames !== undefined && (!Array.isArray(datos.frames) || datos.frames.length > 5
        || !datos.frames.every((frame: unknown) => typeof frame === 'string' && frame.length <= 160 && /^\/_next\/static\/chunks\/[\w./[\]-]+\.js:\d+:\d+$/.test(frame))))
      || (diagnostico !== undefined && (!diagnostico || !categoriasErrorCliente.includes(diagnostico.categoria)
        || !fuentesErrorCliente.includes(diagnostico.fuente) || typeof diagnostico.tienePila !== 'boolean'
        || (diagnostico.evento !== undefined && !eventosErrorCliente.includes(diagnostico.evento))
        || (diagnostico.enLinea !== undefined && typeof diagnostico.enLinea !== 'boolean')))) {
      return new Response(null, { status: 400, headers })
    }
    // All browser reports are untrusted; only allowlisted fields enter logs.
    registrarError(`client_error_${datos.origen}`, { name: datos.nombre, digest: datos.digest }, {
      route: rutaDiagnostico(datos.ruta), routeType: 'client', clientFrames: datos.frames,
      clientDiagnostic: diagnostico === undefined ? undefined : {
        categoria: diagnostico.categoria, fuente: diagnostico.fuente, evento: diagnostico.evento,
        tienePila: diagnostico.tienePila, enLinea: diagnostico.enLinea,
      },
    })
    return new Response(null, { status: 204, headers })
  } catch {
    return new Response(null, { status: 400, headers })
  } finally { reader.releaseLock() }
}
