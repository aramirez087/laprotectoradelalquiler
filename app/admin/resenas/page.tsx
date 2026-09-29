import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CabeceraAdmin, ResultadosAdmin, VacioAdmin } from '@/components/admin-ui'
import { consultarResenas, SinClaveAdmin, TAMANO_PAGINA_ADMIN } from '@/lib/admin'
import { Paginacion } from '@/components/paginacion'
import { ResenaAdmin } from '@/components/resena-admin'
import { esEstadoResena, etiquetaEstado, paginaSegura, primer } from '@/lib/util'

export const metadata = { title: 'Consultar reseñas' }

function hrefLista(opts: { q?: string; estado?: string; pagina?: number }) {
  const p = new URLSearchParams()
  if (opts.q) p.set('q', opts.q)
  if (opts.estado) p.set('estado', opts.estado)
  if (opts.pagina && opts.pagina > 1) p.set('pagina', String(opts.pagina))
  const s = p.toString()
  return s ? `/admin/resenas?${s}` : '/admin/resenas'
}

export default async function ConsultarPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await props.searchParams
  const q = primer(params.q).trim()
  const estadoRaw = primer(params.estado)
  const estado = esEstadoResena(estadoRaw) ? estadoRaw : ''
  const pagina = paginaSegura(primer(params.pagina))

  let filas: Awaited<ReturnType<typeof consultarResenas>>['filas'] = []
  let total = 0
  let aviso: string | null = null
  try {
    const resultado = await consultarResenas({ q, estado, pagina })
    filas = resultado.filas
    total = resultado.total
  } catch (e) {
    aviso = e instanceof SinClaveAdmin ? e.message : 'No pudimos consultar las reseñas.'
  }

  const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_ADMIN))
  if (!aviso && pagina > paginas) redirect(hrefLista({ q, estado, pagina: paginas }))

  return (
    <div className="contenedor space-y-7">
      <CabeceraAdmin titulo="Reseñas" descripcion="Encuentre una experiencia, consulte su estado o gestione su publicación." accion={<Link href="/resenas/nueva" className="btn-primario">Escribir reseña</Link>} />
      <form method="GET" className="expediente grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end" role="search" aria-label="Buscar reseñas">
        <div className="min-w-0">
          <label className="etiqueta-campo" htmlFor="q">Nombre, cédula o comentario</label>
          <input id="q" type="search" name="q" defaultValue={q} placeholder="Escriba lo que quiere encontrar" className="campo" />
        </div>
        <div>
          <label className="etiqueta-campo" htmlFor="estado">Estado de la reseña</label>
          <select id="estado" name="estado" defaultValue={estado} className="campo">
            <option value="">Todos los estados</option>
            <option value="publicada">Publicadas</option>
            <option value="borrador">En revisión</option>
            <option value="oculta">Rechazadas</option>
          </select>
        </div>
        <button type="submit" className="btn-primario">Buscar</button>
        {(q || estado) && <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:col-span-3"><p className="min-w-0 break-words text-ink-soft">{q && <>Búsqueda: «{q}»</>}{q && estado && ' · '}{estado && etiquetaEstado(estado)}</p><Link href="/admin/resenas" className="enlace-texto">Limpiar filtros</Link></div>}
      </form>
      {aviso && <p className="aviso aviso-error" role="alert">{aviso}</p>}
      {!aviso && <ResultadosAdmin pagina={pagina} tamano={TAMANO_PAGINA_ADMIN} total={total} />}
      {!aviso && filas.length === 0 && <VacioAdmin titulo={q || estado ? 'No encontramos reseñas con estos filtros' : 'Todavía no hay reseñas'} descripcion={q || estado ? 'Pruebe otro nombre, una parte del comentario o consulte todos los estados.' : 'Las experiencias de la comunidad aparecerán aquí, con su estado y las opciones de moderación.'} href={q || estado ? '/admin/resenas' : '/resenas/nueva'} accion={q || estado ? 'Ver todas las reseñas' : 'Escribir una reseña'} />}
      <div className="space-y-5">
        {filas.map((fila) => (
          <ResenaAdmin key={fila.id} fila={fila} />
        ))}
      </div>
      <Paginacion pagina={pagina} paginas={paginas} href={(n) => hrefLista({ q, estado, pagina: n })} />
    </div>
  )
}
