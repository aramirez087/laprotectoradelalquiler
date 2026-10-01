import type { ResumenResultadosBusqueda } from '@/lib/resultados-busqueda'
import { formatoNumero } from '@/lib/util'

export function ResultadosBusquedaAdmin({ resumen }: { resumen: ResumenResultadosBusqueda | null }) {
  if (!resumen) return <section className="expediente space-y-3"><h2 className="text-xl">De la búsqueda a las experiencias</h2>
    <p role="alert" className="text-sm text-ink-soft">No pudimos cargar los resultados de búsqueda. Revise la migración y vuelva a intentar. Los datos no disponibles no se muestran como cero.</p></section>
  const porcentaje = (parte: number, total: number) => total ? `${Math.round(parte / total * 100)}%` : '—'
  const tarjetas = [
    ['Miembros que abren una ficha', porcentaje(resumen.miembros_con_apertura, resumen.miembros), `${formatoNumero(resumen.miembros_con_apertura)} de ${formatoNumero(resumen.miembros)} miembros que buscaron abrieron una ficha con reseñas publicadas desde sus resultados.`],
    ['Búsquedas sin resultados', porcentaje(resumen.sin_resultados, resumen.busquedas), `${formatoNumero(resumen.sin_resultados)} de ${formatoNumero(resumen.busquedas)} búsquedas no encontraron fichas con reseñas publicadas.`],
    ['Búsquedas con apertura', porcentaje(resumen.con_apertura, resumen.busquedas), `${formatoNumero(resumen.con_apertura)} búsquedas llevaron a abrir al menos una ficha. Abrir varias desde los mismos resultados cuenta una vez.`],
    ['Miembros que vuelven a buscar', porcentaje(resumen.miembros_recurrentes, resumen.miembros), `${formatoNumero(resumen.miembros_recurrentes)} miembros buscaron en dos o más días distintos del período, según la hora de Costa Rica.`],
  ] as const
  const fecha = new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium', timeZone: 'America/Costa_Rica' }).format(new Date(resumen.iniciada_en))
  return <section className="space-y-5" aria-labelledby="titulo-resultados-busqueda">
    <div><h2 id="titulo-resultados-busqueda" className="text-2xl">De la búsqueda a las experiencias</h2>
      <p className="mt-2 text-sm leading-6 text-ink-soft">Mide si los miembros encuentran fichas y las abren. Abrir una ficha no confirma que sea la persona buscada ni que se haya leído todo el relato.</p>
      <p className="mt-1 text-xs text-ink-soft">Desde el {fecha} · últimos días completos del período seleccionado.</p></div>
    {resumen.busquedas === 0 && <p className="aviso">Todavía no hay búsquedas medidas en este período. Las búsquedas de hoy aparecerán al cerrar el día de Costa Rica.</p>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{tarjetas.map(([titulo, valor, detalle]) => <div key={titulo} className="metrico">
      <h3 className="text-sm font-normal text-ink-soft">{titulo}</h3><p className="mt-4 text-4xl tabular-nums">{valor}</p>
      <p className="mt-3 text-xs leading-5 text-ink-soft">{detalle}</p>
    </div>)}</div>
    <p className="text-sm text-ink-soft">{formatoNumero(resumen.con_resultados)} búsquedas con resultados · {formatoNumero(resumen.documentos)} por documento · {formatoNumero(resumen.nombres)} por nombre.</p>
    <details className="expediente text-sm leading-6 text-ink-soft"><summary className="cursor-pointer font-medium text-ink">Cómo se mide la búsqueda</summary>
      <div className="mt-4 space-y-3"><p>Solo cuentan búsquedas válidas de propietarios y agencias con permiso vigente, cuando la página se abre en una pestaña visible. Administración, el listado sin búsqueda, errores y precargas quedan fuera. Las aperturas se vinculan a los resultados durante 30 minutos; los enlaces directos no cuentan como aperturas desde una búsqueda.</p>
        <p>Cada búsqueda lleva una referencia temporal para evitar duplicados al paginar o volver desde una ficha. Volver a enviar el formulario inicia otra consulta; recargar conserva la referencia mientras siga vigente. Una cuenta cuenta una vez por miembro en el período; varios dispositivos con la misma cuenta no crean varios miembros.</p>
        <p>La medición respeta «No rastrear» y Global Privacy Control. Un bloqueador o la falta de JavaScript puede reducir las cifras. Solo se guardan la cuenta, la fecha, el tipo de búsqueda y si hubo resultados o una apertura; se eliminan a los 90 días o al borrar la cuenta. No se guardan nombres, cédulas, identificadores de fichas ni texto buscado en estas métricas, y no se envían a Statsig.</p></div>
    </details>
  </section>
}
