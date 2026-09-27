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
      <h1 className="text-2xl">Error</h1>
      <button type="button" onClick={() => retry()} className="btn-primario mt-6">
        Reintentar
      </button>
    </div>
  )
}
