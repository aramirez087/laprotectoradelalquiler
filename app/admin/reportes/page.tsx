import Link from 'next/link'
import { atajosPeriodo, consultarResenas, periodoPorDefecto, SinClaveAdmin, TAMANO_PAGINA_ADMIN } from '@/lib/admin'
import { Paginacion } from '@/components/paginacion'
import { ResenaAdmin } from '@/components/resena-admin'
import { formatoNumero, paginaSegura, primer } from '@/lib/util'

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
    aviso = e instanceof SinClaveAdmin ? e.message : 'No pudimos cargar el reporte.'
  }

  const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_ADMIN))

  return (
    <div className="contenedor space-y-5">
      <h1 className="text-3xl">Reportes</h1>
      <div className="flex flex-wrap gap-2">
        <Link href={hrefReporte(atajos.hoy.desde, atajos.hoy.hasta)} className="btn-secundario">
          Hoy
        </Link>
        <Link href={hrefReporte(atajos.mes.desde, atajos.mes.hasta)} className="btn-secundario">
          Este mes
        </Link>
        <Link href={hrefReporte(atajos.anio.desde, atajos.anio.hasta)} className="btn-secundario">
          Este año
        </Link>
      </div>
      <form method="GET" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
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
        <button className="btn-primario">Ver</button>
      </form>
      {aviso && <p className="aviso aviso-error">{aviso}</p>}
      {!aviso && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-soft">{total === 1 ? '1 reseña' : `${formatoNumero(total)} reseñas`}</p>
          <a className="text-sm font-medium" href={`/admin/reportes/csv?desde=${desde}&hasta=${hasta}`}>
            Descargar
          </a>
        </div>
      )}
      {!aviso && filas.length === 0 && <p className="text-sm text-ink-soft">No hay reseñas en esas fechas.</p>}
      <div className="space-y-3">
        {filas.map((fila) => (
          <ResenaAdmin key={fila.id} fila={fila} />
        ))}
      </div>
      <Paginacion pagina={pagina} paginas={paginas} href={(n) => hrefReporte(desde, hasta, n)} />
    </div>
  )
}
