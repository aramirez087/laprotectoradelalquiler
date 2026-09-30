import { registrarError } from '@/lib/registro-error'
import { esOrigenPropio } from '@/lib/origen'

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
    if (!['limite', 'navegador', 'accion'].includes(datos?.origen) || !nombres.has(datos?.nombre)
      || (datos.digest !== undefined && (typeof datos.digest !== 'string' || !/^\d{1,20}(?:@E\d{1,8})?$/.test(datos.digest)))) {
      return new Response(null, { status: 400, headers })
    }
    // All browser reports are untrusted; only allowlisted fields enter logs.
    registrarError(`client_error_${datos.origen}`, { name: datos.nombre, digest: datos.digest }, { route: '/api/errores', routeType: 'client' })
    return new Response(null, { status: 204, headers })
  } catch {
    return new Response(null, { status: 400, headers })
  } finally { reader.releaseLock() }
}
