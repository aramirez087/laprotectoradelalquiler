'use client'

import { useEffect, useTransition } from 'react'
import Link from '@/components/enlace'
import { Icono } from '@/components/icono'
import { registrarErrorCliente } from '@/lib/error-cliente'
import { IndicadorCarga } from '@/components/indicador-carga'

export default function ErrorPagina({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const [pendiente, startTransition] = useTransition()
  useEffect(() => {
    registrarErrorCliente(error, 'limite')
  }, [error])

  return (
    <div className="pantalla-estado">
      <span className="icono-estado mb-5"><Icono nombre="revisar" /></span>
      <h1 className="text-2xl">No pudimos cargar esta página</h1>
      <p className="mt-3 text-sm text-ink-soft">Intente de nuevo. Si el problema continúa, vuelva en unos minutos.</p>
      {error.digest && <p className="mt-3 text-xs text-ink-soft">Referencia para soporte: {error.digest}</p>}
      <button type="button" disabled={pendiente} aria-busy={pendiente} onClick={() => startTransition(() => retry())} className="btn-primario mt-6">
        {pendiente ? <IndicadorCarga texto="Reintentando…" /> : 'Volver a intentar'}
      </button>
      <p className="sr-only" role="status">{pendiente ? 'Cargando la página de nuevo.' : ''}</p>
      <Link href="/" className="enlace-texto mt-3">Volver al inicio</Link>
    </div>
  )
}
