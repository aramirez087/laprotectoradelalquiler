'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { dispositivoAudiencia, eventoPublicoAudiencia, eventosAudiencia, fuenteAudiencia, paginaAudiencia } from '@/lib/audiencia'
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
  const actual = useRef({ administra, habilitada })
  const ultimaVisita = useRef<{ path: string; enviados: Set<string>; pendientes: Set<string> } | null>(null)
  useEffect(() => {
    actual.current = { administra, habilitada }
    if (ultimaVisita.current?.path !== path) {
      ultimaVisita.current = { path, enviados: new Set(), pendientes: new Set() }
    }
    const visita = ultimaVisita.current
    const key = process.env.NEXT_PUBLIC_STATSIG_CLIENT_KEY
    const navegador = navigator as Navigator & { globalPrivacyControl?: boolean }
    const pagina = paginaAudiencia(path)
    const permitido = () => actual.current.habilitada && !actual.current.administra
      && navegador.doNotTrack !== '1' && navegador.globalPrivacyControl !== true
      && document.visibilityState === 'visible'
    if (!habilitada || administra || !key || !pagina) return

    // Reserve before loading the SDK, so rapid clicks and Strict Mode cannot duplicate a visit.
    // Navigation never waits for analytics. Only fixed event names reach logEvent.
    function enviar(nombre: string, eventos: () => string[]) {
      if (!permitido() || visita.enviados.has(nombre) || visita.pendientes.has(nombre)) return
      visita.pendientes.add(nombre)
      void clienteAudiencia(key!).then(instancia => {
        if (!permitido()) return
        for (const evento of eventos()) instancia.logEvent(evento)
        visita.enviados.add(nombre)
      }).catch(() => { /* Analytics failures never affect the page or navigation. */ })
        .finally(() => { visita.pendientes.delete(nombre) })
    }

    function medirVisita() {
      enviar('site_page_view', () => {
        const ahora = Date.now()
        let nuevaSesion = false
        try {
          const anterior = Number(sessionStorage.getItem('protectora-audiencia-actividad'))
          nuevaSesion = !anterior || ahora - anterior > 30 * 60_000
          sessionStorage.setItem('protectora-audiencia-actividad', String(ahora))
        } catch { /* Page views still work when browser storage is blocked. */ }
        const fuente = nuevaSesion ? fuenteAudiencia(document.referrer, location.origin) : null
        return eventosAudiencia(pagina!, dispositivoAudiencia(navigator.userAgent), fuente)
      })
      medirRegistro()
    }

    let observador: MutationObserver | undefined
    function medirRegistro() {
      if (path !== '/registro' || !permitido()) return
      // A server-rendered, fixed marker identifies the contextual registration page.
      // Never inspect the query string, form fields, link URLs or account identity.
      const marca = document.querySelector('[data-visita-publica="registro_desde_ejemplo"]')
      if (!marca?.getClientRects().length) return
      const evento = eventoPublicoAudiencia('registro_desde_ejemplo', path, 'visita')
      if (evento) enviar(evento, () => [evento])
      observador?.disconnect()
    }

    function medirClic(evento: MouseEvent) {
      if (evento.button !== 0 || !(evento.target instanceof Element)) return
      const elemento = evento.target.closest('[data-evento-publico]')
      const nombre = eventoPublicoAudiencia(elemento?.getAttribute('data-evento-publico') ?? null, path, 'clic')
      if (nombre) enviar(nombre, () => [nombre])
    }

    // Registration content may stream after the persistent layout has mounted.
    if (path === '/registro') {
      observador = new MutationObserver(medirRegistro)
      observador.observe(document.body, { childList: true, subtree: true })
    }
    medirVisita()
    document.addEventListener('visibilitychange', medirVisita)
    document.addEventListener('click', medirClic, { capture: true })
    return () => {
      observador?.disconnect()
      document.removeEventListener('visibilitychange', medirVisita)
      document.removeEventListener('click', medirClic, { capture: true })
    }
  }, [path, administra, habilitada])
  return null
}
