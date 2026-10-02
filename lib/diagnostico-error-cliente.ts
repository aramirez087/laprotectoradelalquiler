export const categoriasErrorCliente = ['network', 'aborted', 'chunk-load', 'property-access', 'not-callable', 'other'] as const
export const fuentesErrorCliente = ['app', 'inline', 'external', 'extension', 'unknown'] as const
export const eventosErrorCliente = ['error', 'unhandledrejection'] as const

export type ContextoErrorCliente = {
  evento?: typeof eventosErrorCliente[number]
  archivo?: string
  linea?: number
  columna?: number
}

export type DiagnosticoErrorCliente = {
  categoria: typeof categoriasErrorCliente[number]
  fuente: typeof fuentesErrorCliente[number]
  evento?: typeof eventosErrorCliente[number]
  tienePila: boolean
  enLinea?: boolean
}

/** Classify locally; never transmit the message, arbitrary URLs or raw stack. */
export function diagnosticoErrorCliente(error: unknown, contexto: ContextoErrorCliente, origen: string) {
  const fallo = error && typeof error === 'object' ? error as Record<string, unknown> : {}
  const mensaje = typeof fallo.message === 'string' ? fallo.message : ''
  const pila = typeof fallo.stack === 'string' ? fallo.stack : ''
  let categoria: DiagnosticoErrorCliente['categoria'] = 'other'
  if (/^(?:Load failed|Failed to fetch|NetworkError when attempting to fetch resource\.)$/i.test(mensaje)) categoria = 'network'
  else if (fallo.name === 'AbortError' || /^(?:cancelled|canceled)$/i.test(mensaje)) categoria = 'aborted'
  else if (fallo.name === 'ChunkLoadError' || /^Loading chunk [\w-]+ failed/.test(mensaje)) categoria = 'chunk-load'
  else if (/is not (?:an object|a function)|Cannot (?:read|set) propert/.test(mensaje)) {
    categoria = mensaje.includes('is not a function') ? 'not-callable' : 'property-access'
  }

  const frames: string[] = []
  let fuente: DiagnosticoErrorCliente['fuente'] = 'unknown'
  function localizar(archivo: string, linea?: number, columna?: number) {
    try {
      const url = new URL(archivo, origen)
      const tipo: DiagnosticoErrorCliente['fuente'] = /^(?:chrome|moz|safari-web)-extension:$/.test(url.protocol)
        ? 'extension'
        : !['http:', 'https:'].includes(url.protocol) ? 'unknown'
          : url.origin !== origen ? 'external'
            : url.pathname.endsWith('.js') ? 'app' : 'inline'
      // The event filename / first stack location describes the throw site.
      if (fuente === 'unknown') fuente = tipo
      if (tipo !== 'app' || !/^\/_next\/static\/chunks\/[\w./[\]-]+\.js$/.test(url.pathname)
        || !Number.isSafeInteger(linea) || !Number.isSafeInteger(columna) || linea! < 1 || columna! < 1) return
      const frame = `${url.pathname}:${linea}:${columna}`
      if (frame.length <= 160 && !frames.includes(frame) && frames.length < 3) frames.push(frame)
    } catch { /* Malformed or browser-injected sources remain unknown. */ }
  }
  if (contexto.archivo) localizar(contexto.archivo, contexto.linea, contexto.columna)
  for (const linea of pila.split('\n').slice(0, 20)) {
    // Both WebKit's function@URL and Chromium's "at function (URL)" format.
    if (!/^\s*at /.test(linea) && !/@(?:https?|[\w-]+-extension):\/\//.test(linea) && !/^https?:\/\//.test(linea)) continue
    const match = linea.match(/((?:https?|chrome-extension|moz-extension|safari-web-extension):\/\/[^\s()]+):([0-9]+):([0-9]+)\)?$/)
    if (match) localizar(match[1], Number(match[2]), Number(match[3]))
  }
  return { frames, diagnostico: { categoria, fuente, evento: contexto.evento, tienePila: pila.length > 0 } satisfies DiagnosticoErrorCliente }
}
