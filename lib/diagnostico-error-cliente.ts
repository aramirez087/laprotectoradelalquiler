export const categoriasErrorCliente = ['network', 'aborted', 'chunk-load', 'property-access', 'not-callable', 'browser-wallet', 'other'] as const
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
  const diagnostico: DiagnosticoErrorCliente = { categoria, fuente: 'unknown', evento: contexto.evento, tienePila: pila.length > 0 }
  function localizar(archivo: string, linea?: number, columna?: number) {
    try {
      const url = new URL(archivo, origen)
      const tipo: DiagnosticoErrorCliente['fuente'] = /^(?:chrome|moz|safari-web)-extension:$/.test(url.protocol)
        ? 'extension'
        : !['http:', 'https:'].includes(url.protocol) ? 'unknown'
          : url.origin !== origen ? 'external'
            : url.pathname.endsWith('.js') ? 'app' : 'inline'
      // The event filename / first stack location describes the throw site.
      if (diagnostico.fuente === 'unknown') diagnostico.fuente = tipo
      if (tipo !== 'app' || !/^\/_next\/static\/(?:immutable\/)?chunks\/[\w./[\]-]+\.js$/.test(url.pathname)
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
  // Brave iOS evaluates these assignments in pages even when its wallet provider
  // is absent. This app has no wallet integration. Match only the documented
  // WebKit error, from inline code, with no app frames; keep all other failures.
  // https://github.com/brave/brave-browser/issues/58670
  if (fallo.name === 'TypeError' && contexto.evento === 'error' && diagnostico.fuente === 'inline' && frames.length === 0
    && /^undefined is not an object \(evaluating 'window\.ethereum\.(?:chainId|networkVersion|selectedAddress) = (?:undefined|"(?:0x)?[0-9a-fA-F]+")'\)$/.test(mensaje)) {
    diagnostico.categoria = 'browser-wallet'
  }
  return { frames, diagnostico }
}
