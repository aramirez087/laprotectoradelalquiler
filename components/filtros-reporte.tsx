'use client'

import Link, { useLinkStatus } from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition, type FormEvent, type Ref } from 'react'

type Periodo = { etiqueta: string; desde: string; hasta: string; href: string }

function EtiquetaPeriodo({ etiqueta, activo }: { etiqueta: string; activo: boolean }) {
  const { pending } = useLinkStatus()
  return <span className="periodo-reporte-contenido" data-cargando={pending || undefined}>
    <span className="periodo-reporte-indicador" aria-hidden="true">
      {pending ? <span className="rueda-carga" /> : activo ? '✓' : null}
    </span>
    <span>{etiqueta}</span>
    <span className="sr-only" role="status">{pending ? `Cargando reporte: ${etiqueta}…` : ''}</span>
  </span>
}

function FechasReporte({ desde, hasta, ref }: { desde: string; hasta: string; ref: Ref<HTMLFormElement> }) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function aplicar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const datos = new FormData(form)
    const inicio = String(datos.get('desde') ?? '')
    const fin = String(datos.get('hasta') ?? '')
    if (inicio > fin) {
      setError('La fecha final debe ser igual o posterior a la fecha inicial.')
      const campoHasta = form.elements.namedItem('hasta') as HTMLInputElement
      campoHasta.focus()
      return
    }
    setError(null)
    startTransition(() => {
      router.push(`/admin/reportes?${new URLSearchParams({ desde: inicio, hasta: fin })}`, { scroll: false })
    })
  }

  return <form ref={ref} action="/admin/reportes" method="GET" onSubmit={aplicar}
    onReset={() => setError(null)} onInput={() => setError(null)} aria-busy={pendiente}>
    <fieldset disabled={pendiente} className="fechas-reporte-campos">
      <legend className="sr-only">Fechas personalizadas</legend>
      <div>
        <label className="etiqueta-campo" htmlFor="desde">Desde</label>
        <input id="desde" name="desde" type="date" defaultValue={desde} required className="campo" />
      </div>
      <div>
        <label className="etiqueta-campo" htmlFor="hasta">Hasta</label>
        <input id="hasta" name="hasta" type="date" defaultValue={hasta} required className="campo"
          aria-invalid={error ? true : undefined} aria-describedby={error ? 'error-fechas-reporte' : undefined} />
      </div>
      <button type="submit" className="btn-primario">{pendiente ? 'Aplicando…' : 'Aplicar fechas'}</button>
    </fieldset>
    {error && <p id="error-fechas-reporte" role="alert" className="mt-3 text-sm text-alerta">{error}</p>}
    <p className="mt-3 text-xs leading-5 text-ink-soft" role="status">
      {pendiente ? 'Actualizando las reseñas del período…' : 'Se incluyen ambos días. Las fechas usan la hora de Costa Rica.'}
    </p>
  </form>
}

export function FiltrosReporte({ desde, hasta, periodos, intervalo }: {
  desde: string; hasta: string; periodos: Periodo[]; intervalo: string
}) {
  const form = useRef<HTMLFormElement>(null)
  const seleccionado = periodos.find(periodo => periodo.desde === desde && periodo.hasta === hasta)

  return <section className="filtros-reporte" aria-labelledby="periodo-reporte-titulo">
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <h2 id="periodo-reporte-titulo" className="text-base font-semibold">Período del reporte</h2>
      <span className="text-xs text-ink-soft">Hora de Costa Rica</span>
    </div>
    <nav className="periodos-reporte" aria-label="Períodos del reporte">
      {periodos.map(periodo => <Link key={periodo.etiqueta} href={periodo.href} scroll={false}
        onNavigate={() => form.current?.reset()} className="periodo-reporte"
        aria-current={seleccionado === periodo ? 'date' : undefined}>
        <EtiquetaPeriodo etiqueta={periodo.etiqueta} activo={seleccionado === periodo} />
      </Link>)}
    </nav>
    <div className="rango-reporte">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18m-13 4h3m2 0h3m-8 3h3" strokeLinecap="round" />
      </svg>
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-soft">{seleccionado?.etiqueta ?? 'Fechas personalizadas'}</p>
        <p className="mt-1 font-medium leading-snug">{intervalo}</p>
      </div>
      <p className="reporte-cargando" role="status"><span className="rueda-carga" aria-hidden="true" />Actualizando reporte…</p>
    </div>
    <details key={`${desde}-${hasta}`} className="fechas-reporte detalles-admin" open={!seleccionado}>
      <summary><span>Elegir otras fechas</span><span className="indicador-admin" aria-hidden="true">⌄</span></summary>
      <div className="pb-1 pt-3"><FechasReporte ref={form} desde={desde} hasta={hasta} /></div>
    </details>
  </section>
}
