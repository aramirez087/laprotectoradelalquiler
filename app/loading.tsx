export default function Cargando() {
  return (
    <div className="contenedor" data-cargando="true" aria-busy="true">
      <div className="text-sm text-ink-soft"><IndicadorCarga texto="Cargando contenido…" /></div>
      <div className="mt-6 space-y-3" aria-hidden="true">
        <div className="esqueleto h-8 w-56" />
        <div className="esqueleto h-28 w-full" />
        <div className="esqueleto h-28 w-full" />
      </div>
    </div>
  )
}
import { IndicadorCarga } from '@/components/indicador-carga'
