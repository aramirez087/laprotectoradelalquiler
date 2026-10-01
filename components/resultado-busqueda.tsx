'use client'

import { startTransition, useEffect } from 'react'
import { registrarResultadoBusquedaAction } from '@/lib/actions/resultados-busqueda'

/** Only mounted, visible journeys count; rendering/prefetching never records a view. */
export function ResultadoBusqueda({ confirmacion, persistirContexto = false }: { confirmacion: string; persistirContexto?: boolean }) {
  useEffect(() => {
    const privacidad = navigator as Navigator & { globalPrivacyControl?: boolean }
    if (privacidad.doNotTrack === '1' || privacidad.globalPrivacyControl) return
    let enviado = false
    function registrar() {
      if (document.visibilityState !== 'visible' || enviado) return
      enviado = true
      if (persistirContexto) {
        // Keep the signed journey across reloads; this does not start a navigation.
        const url = new URL(window.location.href)
        if (url.searchParams.get('consulta') !== confirmacion) {
          url.searchParams.set('consulta', confirmacion)
          window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
        }
      }
      startTransition(() => { void registrarResultadoBusquedaAction(confirmacion).catch(() => {}) })
    }
    registrar()
    document.addEventListener('visibilitychange', registrar)
    return () => document.removeEventListener('visibilitychange', registrar)
  }, [confirmacion, persistirContexto])
  return null
}
