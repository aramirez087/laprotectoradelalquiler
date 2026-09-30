/** Next may build request.url with an internal hostname behind a proxy. */
export function esOrigenPropio(request: Request) {
  const origen = request.headers.get('origin')
  if (!origen) return false
  try {
    const url = new URL(request.url)
    const host = request.headers.get('host') ?? url.host
    const protocolo = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? url.protocol.slice(0, -1)
    if (!['http', 'https'].includes(protocolo)) return false
    // Host is supplied by HTTP routing, not a caller-provided forwarded-host.
    return new URL(origen).origin === new URL(`${protocolo}://${host}`).origin
  } catch { return false }
}
