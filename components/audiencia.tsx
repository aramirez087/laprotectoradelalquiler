'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { dispositivoAudiencia, eventosAudiencia, fuenteAudiencia, paginaAudiencia } from '@/lib/audiencia'
import type { StatsigClient } from '@statsig/js-client'

let cliente: Promise<StatsigClient> | null = null
function clienteAudiencia(key: string) {
  if (!cliente) cliente = import('@statsig/js-client').then(async ({ StatsigClient }) => {
    let id = crypto.randomUUID() as string
    try {
      const guardado = localStorage.getItem('protectora-audiencia')
      if (guardado && /^[a-f0-9-]{36}$/i.test(guardado)) id = guardado
      else localStorage.setItem('protectora-audiencia', id)
    } catch { /* Without storage, the count is an estimate per page load. */ }
    const instancia = new StatsigClient(key, { userID: id }, {
      environment: { tier: 'production' },
      disableStableID: true, enableCookies: false,
      includeCurrentPageUrlWithEvents: false,
      networkConfig: {
        initializeUrl: 'https://api.statsig.com/v1/initialize',
        initializeFallbackUrls: [], logEventUrl: 'https://api.statsig.com/v1/rgstr',
        logEventFallbackUrls: [], sdkExceptionUrl: 'https://api.statsig.com/v1/sdk_exception',
        networkTimeoutMs: 5000,
      },
    })
    await instancia.initializeAsync()
    return instancia
  }).catch(error => { cliente = null; throw error })
  return cliente
}

export function Audiencia({ administra, habilitada }: { administra: boolean; habilitada: boolean }) {
  const path = usePathname()
  const ultimo = useRef<string | null>(null)
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_STATSIG_CLIENT_KEY
    const navegador = navigator as Navigator & { globalPrivacyControl?: boolean }
    const pagina = paginaAudiencia(path)
    if (!habilitada || administra || !key || !pagina || ultimo.current === path
      || navegador.doNotTrack === '1' || navegador.globalPrivacyControl === true) return
    ultimo.current = path
    // Queue each navigation once, including rapid route changes. No page content is read.
    void clienteAudiencia(key).then(instancia => {
      const ahora = Date.now()
      let nuevaSesion = false
      try {
        const anterior = Number(sessionStorage.getItem('protectora-audiencia-actividad'))
        nuevaSesion = !anterior || ahora - anterior > 30 * 60_000
        sessionStorage.setItem('protectora-audiencia-actividad', String(ahora))
      } catch { /* Page views still work when browser storage is blocked. */ }
      const fuente = nuevaSesion ? fuenteAudiencia(document.referrer, location.origin) : null
      for (const evento of eventosAudiencia(pagina, dispositivoAudiencia(navigator.userAgent), fuente)) {
        instancia.logEvent(evento)
      }
    }).catch(() => { if (ultimo.current === path) ultimo.current = null })
  }, [path, administra, habilitada])
  return null
}
