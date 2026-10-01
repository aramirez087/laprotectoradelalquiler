import Link from '@/components/enlace'
import { CabeceraAdmin, VacioAdmin } from '@/components/admin-ui'
import { GraficoAudiencia } from '@/components/grafico-audiencia'
import { estadisticasAdmin } from '@/lib/estadisticas'
import { periodoAudiencia } from '@/lib/audiencia'
import { formatoNumero, primer } from '@/lib/util'

export const metadata = { title: 'Estadísticas' }

function fechaCorta(fecha: string) {
  return new Intl.DateTimeFormat('es-CR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${fecha}T12:00:00Z`))
}

function Distribucion({ titulo, filas, unidad }: { titulo: string; filas: { etiqueta: string; cantidad: number }[]; unidad: string }) {
  const total = filas.reduce((s, f) => s + f.cantidad, 0)
  return <section className="expediente min-w-0">
    <h2 className="text-lg font-medium">{titulo}</h2>
    <p className="mt-1 text-xs text-ink-soft">{unidad}</p>
    {filas.length === 0 ? <p className="mt-5 text-sm text-ink-soft">Todavía no hay datos procesados para esta distribución.</p> :
      <dl className="mt-5 space-y-4">{filas.map(f => <div key={f.etiqueta}>
        <div className="flex items-baseline justify-between gap-4 text-sm"><dt>{f.etiqueta}</dt><dd className="tabular-nums">{formatoNumero(f.cantidad)} <span className="text-xs text-ink-soft">· {Math.round(f.cantidad / total * 100)}%</span></dd></div>
        <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-seal" style={{ width: `${f.cantidad / total * 100}%` }} /></div>
      </div>)}</dl>}
  </section>
}

export default async function EstadisticasPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await props.searchParams
  const periodo = periodoAudiencia(primer(params.periodo))
  const datos = await estadisticasAdmin(periodo)
  const tarjetas = [
    ['Visitantes únicos', datos.visitantes, 'Navegadores distintos en el período; una persona puede usar varios dispositivos.'],
    ['Páginas vistas', datos.vistas, 'Cada página abierta cuenta como una vista.'],
    ['Visitas', datos.sesiones, 'Una visita nueva comienza tras 30 minutos sin actividad, dentro de una pestaña.'],
    ['Nuevos visitantes', datos.nuevos, 'Navegadores registrados por primera vez en este período.'],
  ] as const
  return <div className="contenedor space-y-7">
    <CabeceraAdmin titulo="Estadísticas del sitio" descripcion="Conozca cuántas personas llegan al sitio y cómo lo utilizan. Estas cifras solo están disponibles para administración." />
    <div className="flex flex-wrap items-center justify-between gap-4">
      <nav className="flex gap-2" aria-label="Período de estadísticas">{([7, 28] as const).map(d =>
        <Link key={d} href={`/admin/estadisticas?periodo=${d}`} aria-current={periodo === d ? 'page' : undefined} className={periodo === d ? 'btn-primario' : 'btn-secundario'}>Últimos {d} días</Link>)}</nav>
      <p className="text-sm text-ink-soft">{fechaCorta(datos.desde)} – {fechaCorta(datos.hasta)} · días cerrados</p>
    </div>
    {!datos.configurado ? <VacioAdmin titulo="Falta conectar los informes" descripcion="La medición necesita su clave pública y una clave de lectura de informes en el servidor. Contacte a quien administra la configuración del sitio." /> :
      datos.errores === periodo ? <p role="alert" className="aviso aviso-error">No pudimos consultar las estadísticas. Intente nuevamente más tarde.</p> : <>
        {!datos.disponible && <VacioAdmin titulo="La medición está lista; los informes aún están pendientes" descripcion="Las cifras comenzarán a aparecer después de las primeras visitas y su procesamiento diario en Statsig, que puede tardar hasta 24 horas. Las visitas anteriores a la activación no se pueden recuperar." />}
        {datos.errores > 0 && <p role="alert" className="aviso aviso-error">Algunos días no pudieron consultarse. Las cifras disponibles están incompletas.</p>}
        {datos.disponible && !datos.completo && datos.errores === 0 && <p className="aviso">Hay informes para {datos.diasDisponibles} de {periodo} días. Los días sin datos se muestran como pendientes.</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{tarjetas.map(([etiqueta, cantidad, detalle]) =>
          <div key={etiqueta} className="metrico"><p className="text-sm text-ink-soft">{etiqueta}</p><p className="mt-4 text-4xl font-medium leading-none tracking-tight tabular-nums">{cantidad === null ? '—' : formatoNumero(cantidad)}</p><p className="mt-3 text-xs leading-5 text-ink-soft">{cantidad === null ? 'Pendiente de procesamiento. ' : ''}{detalle}</p></div>)}</div>
        <GraficoAudiencia key={periodo} serie={datos.serie} />
        <div className="grid gap-5 lg:grid-cols-3"><Distribucion titulo="Páginas más visitadas" filas={datos.paginas} unidad="Páginas vistas por sección" /><Distribucion titulo="De dónde llegan" filas={datos.fuentes} unidad="Visitas por origen de entrada" /><Distribucion titulo="Dispositivos" filas={datos.dispositivos} unidad="Páginas vistas por tipo de dispositivo" /></div>
      </>}
    <details className="expediente text-sm leading-6 text-ink-soft"><summary className="cursor-pointer font-medium text-ink">Cómo se cuentan las visitas</summary><div className="mt-4 space-y-3">
      <p>Se mide únicamente el sitio de producción. Las visitas de administración, las pantallas de recuperación de acceso y las solicitudes automáticas al servidor quedan fuera. Un bloqueador o una preferencia de no seguimiento puede impedir la medición.</p>
      <p>Un visitante es un navegador con un identificador aleatorio; no se vincula con su cuenta. Las cifras por día no se suman para calcular visitantes únicos del período.</p>
      <p>Statsig procesa los informes diariamente. Sus días estadísticos cierran a las 2 a. m. de Costa Rica; el período excluye el día todavía abierto. Un guion o «Pendiente» significa que no hay un informe disponible, no que hubo cero visitas.</p>
      <p>Solo se envían categorías de páginas, orígenes y dispositivos. No se envían nombres, correos, cédulas, búsquedas, identificadores de fichas ni contenido de formularios o reseñas.</p>
    </div></details>
  </div>
}
