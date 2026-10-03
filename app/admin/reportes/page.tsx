import { registrarError } from '@/lib/registro-error'
import { redirect, unstable_rethrow } from 'next/navigation'
import { CabeceraAdmin, ResultadosAdmin } from '@/components/admin-ui'
import { FiltrosReporte } from '@/components/filtros-reporte'
import Link from '@/components/enlace'
import { atajosPeriodo, consultarResenas, periodoPorDefecto, SinClaveAdmin, TAMANO_PAGINA_ADMIN } from '@/lib/admin'
import { Paginacion } from '@/components/paginacion'
import { ResenaReporte } from '@/components/resena-reporte'
import { fechaCorta, formatoNumero, paginaSegura, primer } from '@/lib/util'

export const metadata = { title: 'Reportes' }

function hrefReporte(desde: string, hasta: string, pagina?: number) {
  const p = new URLSearchParams({ desde, hasta })
  if (pagina && pagina > 1) p.set('pagina', String(pagina))
  return `/admin/reportes?${p}`
}

export default async function ReportesPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await props.searchParams
  const { desde, hasta } = periodoPorDefecto(primer(params.desde), primer(params.hasta))
  const pagina = paginaSegura(primer(params.pagina))
  const atajos = atajosPeriodo()
  const periodos = [
    { etiqueta: 'Hoy', ...atajos.hoy },
    { etiqueta: 'Esta semana', ...atajos.semana },
    { etiqueta: 'Este mes', ...atajos.mes },
    { etiqueta: 'Este año', ...atajos.anio },
  ].map(periodo => ({ ...periodo, href: hrefReporte(periodo.desde, periodo.hasta) }))
  const intervalo = desde === hasta ? fechaCorta(desde)! : `${fechaCorta(desde)} al ${fechaCorta(hasta)}`

  let filas: Awaited<ReturnType<typeof consultarResenas>>['filas'] = []
  let total = 0
  let aviso: string | null = null
  try {
    const resultado = await consultarResenas({ desde, hasta, pagina })
    filas = resultado.filas
    total = resultado.total
  } catch (e) {
    unstable_rethrow(e)
    registrarError('page_load_error', e, { route: '/admin/reportes', routeType: 'render' })
    aviso = e instanceof SinClaveAdmin ? e.message : 'No pudimos cargar el reporte.'
  }

  const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_ADMIN))
  if (!aviso && pagina > paginas) redirect(hrefReporte(desde, hasta, paginas))

  return (
    <div className="contenedor pagina-reportes space-y-7">
      <CabeceraAdmin titulo="Reportes" descripcion="Explore las reseñas por fecha y descargue el reporte que necesita." />
      <FiltrosReporte desde={desde} hasta={hasta} periodos={periodos} intervalo={intervalo} />
      {aviso ? <section className="expediente space-y-4 border-alerta" aria-labelledby="reporte-error">
        <div role="alert"><h2 id="reporte-error" className="text-lg">No pudimos completar el reporte</h2><p className="mt-2 text-sm text-ink-soft">{aviso}</p></div>
        <a className="btn-secundario" href={hrefReporte(desde, hasta, pagina)}>Volver a intentar</a>
      </section> : <section className="resultados-reporte space-y-5" aria-labelledby="resultados-reporte-titulo">
        <p className="sr-only" role="status" aria-atomic="true">{total} {total === 1 ? 'reseña' : 'reseñas'} del {intervalo}. Hora de Costa Rica.</p>
        <div className="resumen-reporte">
          <div>
            <h2 id="resultados-reporte-titulo" className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="text-4xl font-medium tracking-tight tabular-nums">{formatoNumero(total)}</span>
              <span className="text-lg">{total === 1 ? 'reseña recibida' : 'reseñas recibidas'}</span>
            </h2>
            <p className="mt-2 text-xs text-ink-soft">{total > 0 ? 'Más recientes primero · Todos los estados' : 'En el período seleccionado'}</p>
          </div>
          {total > 0 && <div className="descarga-reporte">
            <a className="btn-secundario" href={`/admin/reportes/csv?desde=${desde}&hasta=${hasta}`}>
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Descargar CSV
            </a>
            <p className="text-xs text-ink-soft">{total > 5000 ? 'Hasta 5.000 reseñas del período' : 'Incluye todo el período'}</p>
          </div>}
        </div>
        {total > TAMANO_PAGINA_ADMIN && <ResultadosAdmin pagina={pagina} tamano={TAMANO_PAGINA_ADMIN} total={total} />}
        {filas.length === 0 ? <div className="reporte-vacio">
          <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-4 h-9 w-9 text-seal" aria-hidden="true"><rect x="6" y="5" width="20" height="23" rx="3" /><path d="M11 3v5m10-5v5M6 12h20m-14 6h8m-8 5h5" strokeLinecap="round" /></svg>
          <h3 className="text-lg font-medium">No hay reseñas en estas fechas</h3>
          <p className="mt-2 max-w-sm text-sm leading-6 text-ink-soft">Elija un período más amplio o ajuste las fechas para consultar la actividad.</p>
          <Link className="btn-secundario mt-5" href="/admin/resenas">Ver todas las reseñas</Link>
        </div> : <div className="space-y-3">{filas.map(fila => <ResenaReporte key={fila.id} fila={fila} />)}</div>}
        <Paginacion pagina={pagina} paginas={paginas} href={(n) => hrefReporte(desde, hasta, n)} />
      </section>}
    </div>
  )
}
