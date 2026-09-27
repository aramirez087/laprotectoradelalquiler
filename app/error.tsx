'use client'

import { useEffect } from 'react'

export default function ErrorPagina({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="contenedor max-w-xl">
      <h1 className="text-2xl">No pudimos cargar esta página</h1>
      <p className="mt-3 text-sm text-ink-soft">Intente de nuevo. Si el problema continúa, vuelva en unos minutos.</p>
      <button type="button" onClick={() => retry()} className="btn-primario mt-6">
        Reintentar
      </button>
    </div>
  )
}
