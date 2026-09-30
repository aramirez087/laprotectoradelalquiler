import { registrarError } from '@/lib/registro-error'
import { FormularioBusqueda } from '@/components/formulario-busqueda'
import { redirect } from 'next/navigation'
import { CabeceraAdmin, ResultadosAdmin, VacioAdmin } from '@/components/admin-ui'
import Link from '@/components/enlace'
import { atajosPeriodo, consultarResenas, periodoPorDefecto, SinClaveAdmin, TAMANO_PAGINA_ADMIN } from '@/lib/admin'
import { Paginacion } from '@/components/paginacion'
import { ResenaAdmin } from '@/components/resena-admin'
import { paginaSegura, primer } from '@/lib/util'

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

  let filas: Awaited<ReturnType<typeof consultarResenas>>['filas'] = []
  let total = 0
  let aviso: string | null = null
  try {
    const resultado = await consultarResenas({ desde, hasta, pagina })
    filas = resultado.filas
    total = resultado.total
  } catch (e) {
    registrarError('page_load_error', e, { route: '/admin/reportes', routeType: 'render' })
    aviso = e instanceof SinClaveAdmin ? e.message : 'No pudimos cargar el reporte.'
  }

  const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_ADMIN))
  if (!aviso && pagina > paginas) redirect(hrefReporte(desde, hasta, paginas))

  return (
    <div className="contenedor space-y-7">
      <CabeceraAdmin titulo="Reportes" descripcion="Consulte las reseñas recibidas en un período y descargue el resultado completo en formato CSV." />
      <section className="expediente space-y-5" aria-label="Período del reporte">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm text-ink-soft">Períodos rápidos</span>
          {([
            ['Hoy', atajos.hoy],
            ['Este mes', atajos.mes],
            ['Este año', atajos.anio],
          ] as const).map(([etiqueta, periodo]) => {
            const activo = desde === periodo.desde && hasta === periodo.hasta
            return <Link key={etiqueta} href={hrefReporte(periodo.desde, periodo.hasta)} className={activo ? 'btn-primario' : 'btn-secundario'} aria-current={activo ? 'true' : undefined}>{activo && <span aria-hidden="true">✓</span>}{etiqueta}</Link>
          })}
        </div>
      <FormularioBusqueda  className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end" action="/admin/reportes">
        <div>
          <label className="etiqueta-campo" htmlFor="desde">
            Desde
          </label>
          <input id="desde" name="desde" type="date" defaultValue={desde} required className="campo" />
        </div>
        <div>
          <label className="etiqueta-campo" htmlFor="hasta">
            Hasta
          </label>
          <input id="hasta" name="hasta" type="date" defaultValue={hasta} required className="campo" />
        </div>
        <button className="btn-primario">Ver reporte</button>
      </FormularioBusqueda>
      </section>
      {aviso && <p className="aviso aviso-error" role="alert">{aviso}</p>}
      {!aviso && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ResultadosAdmin pagina={pagina} tamano={TAMANO_PAGINA_ADMIN} total={total} />
          {total > 0 && <a className="btn-secundario" href={`/admin/reportes/csv?desde=${desde}&hasta=${hasta}`}>
            Descargar CSV
          </a>}
        </div>
      )}
      {!aviso && filas.length === 0 && <VacioAdmin titulo="No hay reseñas en este período" descripcion="Amplíe el intervalo de fechas o elija otro período para consultar la actividad." />}
      <div className="space-y-5">
        {filas.map((fila) => (
          <ResenaAdmin key={fila.id} fila={fila} />
        ))}
      </div>
      <Paginacion pagina={pagina} paginas={paginas} href={(n) => hrefReporte(desde, hasta, n)} />
    </div>
  )
}
