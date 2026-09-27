export default function Cargando() {
  return (
    <div className="contenedor" aria-busy="true" aria-live="polite">
      <p className="sr-only">Cargando</p>
      <div className="mt-6 space-y-3">
        <div className="esqueleto h-8 w-56" />
        <div className="esqueleto h-28 w-full" />
        <div className="esqueleto h-28 w-full" />
      </div>
    </div>
  )
}
