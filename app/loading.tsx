export default function Cargando() {
  return (
    <div className="contenedor">
      <p className="flex items-center gap-2 text-sm text-ink-soft" role="status">Cargando contenido…</p>
      <div className="mt-6 space-y-3" aria-hidden="true">
        <div className="esqueleto h-8 w-56" />
        <div className="esqueleto h-28 w-full" />
        <div className="esqueleto h-28 w-full" />
      </div>
    </div>
  )
}
