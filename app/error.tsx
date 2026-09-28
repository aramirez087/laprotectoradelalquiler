'use client'

import { useEffect, useTransition } from 'react'
import Link from 'next/link'
import { Icono } from '@/components/icono'

export default function ErrorPagina({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const [pendiente, startTransition] = useTransition()
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="pantalla-estado">
      <span className="icono-estado mb-5"><Icono nombre="revisar" /></span>
      <h1 className="text-2xl">No pudimos cargar esta página</h1>
      <p className="mt-3 text-sm text-ink-soft">Intente de nuevo. Si el problema continúa, vuelva en unos minutos.</p>
      <button type="button" disabled={pendiente} onClick={() => startTransition(() => retry())} className="btn-primario mt-6">
        {pendiente ? 'Reintentando…' : 'Volver a intentar'}
      </button>
      <p className="sr-only" role="status">{pendiente ? 'Cargando la página de nuevo.' : ''}</p>
      <Link href="/" className="enlace-texto mt-3">Volver al inicio</Link>
    </div>
  )
}
