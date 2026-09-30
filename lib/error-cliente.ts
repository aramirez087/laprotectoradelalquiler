const nombres = new Set(['Error', 'TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'AbortError', 'TimeoutError'])
let ultimo = 0

export function registrarErrorCliente(error: unknown, origen: 'limite' | 'navegador' | 'accion') {
  if (typeof window === 'undefined') return
  // Bound duplicate reports, including failures while reporting a failure.
  if (Date.now() - ultimo < 5000) return
  ultimo = Date.now()
  const fallo = error && typeof error === 'object' ? error as Record<string, unknown> : {}
  const digest = typeof fallo.digest === 'string' && /^\d{1,20}(?:@E\d{1,8})?$/.test(fallo.digest) ? fallo.digest : undefined
  void fetch('/api/errores', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origen, nombre: typeof fallo.name === 'string' && nombres.has(fallo.name) ? fallo.name : 'Error', digest }),
    keepalive: true, signal: AbortSignal.timeout(5000),
  }).catch(() => {})
}
