import { rutaDiagnostico } from '@/lib/ruta-diagnostico'
import { diagnosticoErrorCliente, type ContextoErrorCliente } from '@/lib/diagnostico-error-cliente'

const nombres = new Set(['Error', 'TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'AbortError', 'TimeoutError'])
let ultimo = 0

export function registrarErrorCliente(error: unknown, origen: 'limite' | 'navegador' | 'accion', contexto: ContextoErrorCliente = {}) {
  if (typeof window === 'undefined') return
  // Bound duplicate reports, including failures while reporting a failure.
  if (Date.now() - ultimo < 5000) return
  ultimo = Date.now()
  try {
    const fallo = error && typeof error === 'object' ? error as Record<string, unknown> : {}
    const digest = typeof fallo.digest === 'string' && /^\d{1,20}(?:@E\d{1,8})?$/.test(fallo.digest) ? fallo.digest : undefined
    const { frames, diagnostico } = diagnosticoErrorCliente(error, contexto, window.location.origin)
    void fetch('/api/errores', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origen, nombre: typeof fallo.name === 'string' && nombres.has(fallo.name) ? fallo.name : 'Error', digest,
        ruta: rutaDiagnostico(window.location.pathname), frames,
        diagnostico: { ...diagnostico, enLinea: navigator.onLine } }),
      keepalive: true, signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(5000) : undefined,
    }).catch(() => {})
  } catch { /* Reporting must never interrupt error recovery. */ }
}
