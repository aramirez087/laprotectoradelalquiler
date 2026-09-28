export function CalificacionEstrellas({
  valor,
  texto,
}: {
  valor: number | null
  texto?: string | null
}) {
  if (!valor || !Number.isFinite(valor)) return <span className="text-xs text-ink-soft">Sin calificación</span>

  const llena = Math.max(0, Math.min(5, Math.round(valor)))
  const tono = valor < 2.5 ? 'text-alerta' : valor < 3.5 ? 'text-ink-soft' : 'text-moss'
  const etiqueta = texto ? `${valor.toFixed(1)} de 5, ${texto}` : `${valor.toFixed(1)} de 5`

  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 text-sm ${tono}`} role="img" aria-label={etiqueta}>
      <span aria-hidden className="estrellas whitespace-nowrap text-base leading-none">
        {'★'.repeat(llena)}
        <span className="opacity-30">{'★'.repeat(5 - llena)}</span>
      </span>
      <span className="text-xs font-semibold text-ink-soft">
        {texto ? `${Math.round(valor)}/5 · ${texto}` : `${valor.toFixed(1)} / 5`}
      </span>
    </span>
  )
}
