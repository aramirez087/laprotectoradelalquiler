import type { DiagnosticoErrorCliente } from '@/lib/diagnostico-error-cliente'

type ContextoError = {
  route?: string
  routeType?: string
  method?: string
  durationMs?: number
  clientFrames?: string[]
  clientDiagnostic?: DiagnosticoErrorCliente
}

/** Deliberately exclude messages, SQL details, headers, URLs and form values. */
export function registrarError(evento: string, error: unknown, contexto: ContextoError = {}) {
  const fallo = error && typeof error === 'object' ? error as Record<string, unknown> : {}
  const seguro = (valor: unknown) => typeof valor === 'string' && /^[a-zA-Z0-9_.-]{1,128}$/.test(valor) ? valor : undefined
  const digest = typeof fallo.digest === 'string' && /^\d{1,20}(?:@E\d{1,8})?$/.test(fallo.digest) ? fallo.digest : undefined
  const referencia = digest ?? crypto.randomUUID()
  console.error(JSON.stringify({
    level: 'error', event: evento, reference: referencia, timestamp: new Date().toISOString(),
    name: seguro(fallo.name), code: seguro(fallo.code),
    status: typeof fallo.status === 'number' ? fallo.status : undefined,
    // Only source locations; never the first line containing the error message.
    frames: typeof fallo.stack === 'string' ? fallo.stack.split('\n').slice(1)
      .flatMap(linea => {
        if (!/^\s+at /.test(linea) || /[?@]|eval/.test(linea)) return []
        const fuente = linea.match(/(?:\b(?:app|components|lib|node_modules)|\.next\/(?:server|static))\/[\w./[\]-]+\.(?:js|ts|tsx|mjs|cjs):\d+:\d+(?=\)?$)/)
        return fuente ? [fuente[0]] : []
      }).slice(0, 8) : undefined,
    ...contexto,
  }))
  return referencia
}
