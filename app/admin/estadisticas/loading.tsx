import { CabeceraAdmin } from '@/components/admin-ui'

export default function CargandoEstadisticas() {
  return <div className="contenedor space-y-7"><CabeceraAdmin titulo="Estadísticas del sitio" descripcion="Consulte la audiencia y el tráfico del sitio." /><p role="status" className="text-sm text-ink-soft">Consultando los informes de audiencia…</p></div>
}
