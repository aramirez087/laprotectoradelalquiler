export function IndicadorCarga({ texto = 'Cargando…' }: { texto?: string }) {
  return <span className="inline-flex items-center gap-2" role="status">
    <span className="rueda-carga" aria-hidden="true" />{texto}
  </span>
}

/** CSS observes pending links, route fallbacks, forms and background lookups. */
export function ActividadGlobal() {
  return <div className="actividad-global" role="status" aria-live="polite">
    <span className="rueda-carga" aria-hidden="true" />Cargando…
  </div>
}
