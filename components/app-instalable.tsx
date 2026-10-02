'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Marca } from '@/components/marca'

interface SolicitudInstalacion extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function suscribirModo(notificar: () => void) {
  const modo = window.matchMedia('(display-mode: standalone)')
  modo.addEventListener('change', notificar)
  return () => modo.removeEventListener('change', notificar)
}

function modoAplicacion() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function AppInstalable() {
  const dialogo = useRef<HTMLDialogElement>(null)
  const solicitud = useRef<SolicitudInstalacion | null>(null)
  const [instalada, setInstalada] = useState(false)
  const [instalando, setInstalando] = useState(false)
  const independiente = useSyncExternalStore(suscribirModo, modoAplicacion, () => false)

  useEffect(() => {
    function disponible(evento: Event) {
      evento.preventDefault()
      solicitud.current = evento as SolicitudInstalacion
    }
    function instalada() {
      solicitud.current = null
      setInstalada(true)
    }
    window.addEventListener('beforeinstallprompt', disponible)
    window.addEventListener('appinstalled', instalada)

    // Development stays free of persistent workers and stale offline assets.
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
        // Storage restrictions must not prevent normal online use.
        console.warn('No se pudo habilitar la pantalla sin conexión.')
      })
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', disponible)
      window.removeEventListener('appinstalled', instalada)
    }
  }, [])

  async function instalar() {
    const evento = solicitud.current
    if (!evento) {
      dialogo.current?.showModal()
      return
    }
    solicitud.current = null
    setInstalando(true)
    try {
      await evento.prompt()
      await evento.userChoice
    } catch {
      dialogo.current?.showModal()
    } finally {
      setInstalando(false)
    }
  }

  if (independiente || instalada) return null

  return <>
    <button type="button" onClick={instalar} disabled={instalando} className="inline-flex min-h-11 items-center text-seal underline-offset-4 hover:underline disabled:opacity-60">
      {instalando ? 'Abriendo instalación…' : 'Instalar aplicación'}
    </button>
    <dialog ref={dialogo} className="dialogo-instalacion" aria-labelledby="titulo-instalacion" aria-describedby="descripcion-instalacion">
      <Marca />
      <h2 id="titulo-instalacion" className="mt-6 text-2xl">La Protectora, siempre a mano.</h2>
      <p id="descripcion-instalacion" className="mt-3 text-sm leading-relaxed text-ink-soft">Añádala a su pantalla de inicio para abrirla como una aplicación.</p>
      <div className="mt-6 space-y-5 text-sm leading-relaxed">
        <div>
          <h3 className="font-semibold">En iPhone o iPad</h3>
          <p className="mt-1 text-ink-soft">Abra este sitio en Safari, toque <strong>Compartir</strong> y luego <strong>Añadir a pantalla de inicio</strong>. Si aparece <strong>Abrir como app web</strong>, déjelo activado.</p>
          <p className="mt-2 text-ink-soft">Si usa Brave y no ve esa opción, abra esta misma dirección en Safari.</p>
        </div>
        <div>
          <h3 className="font-semibold">En Android o computadora</h3>
          <p className="mt-1 text-ink-soft">Busque <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong> en el menú del navegador. La opción depende del navegador que utilice.</p>
        </div>
        <p className="border-t border-line pt-4 text-ink-soft">Necesita conexión a internet para consultar y enviar reseñas.</p>
      </div>
      <form method="dialog" className="mt-6">
        <button className="btn-primario w-full">Entendido</button>
      </form>
    </dialog>
  </>
}
