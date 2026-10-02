'use client'

import { useSyncExternalStore } from 'react'

function suscribir(notificar: () => void) {
  window.addEventListener('online', notificar)
  window.addEventListener('offline', notificar)
  return () => {
    window.removeEventListener('online', notificar)
    window.removeEventListener('offline', notificar)
  }
}

export function EstadoConexion() {
  const conectado = useSyncExternalStore(suscribir, () => navigator.onLine, () => true)
  if (conectado) return null
  return <div role="status" className="border-t border-line bg-seal-soft px-4 py-2 text-center text-xs text-ink">
    Sin conexión. Necesita internet para consultar o enviar reseñas.
  </div>
}
