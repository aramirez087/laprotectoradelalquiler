import { redirect } from 'next/navigation'
import { consultarResenas, SinClaveAdmin, TAMANO_PAGINA_ADMIN } from '@/lib/admin'
import { Paginacion } from '@/components/paginacion'
import { ResenaAdmin } from '@/components/resena-admin'
import { esEstadoResena, paginaSegura, primer } from '@/lib/util'

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
    <div className="contenedor space-y-5">
      <h1 className="text-3xl">Consultar reseñas</h1>
      <form method="GET" className="buscador" role="search">
        <label className="sr-only" htmlFor="q">
          Nombre, cédula o comentario
        </label>
        <input id="q" type="search" name="q" defaultValue={q} placeholder="Nombre, cédula o comentario" />
        <label className="sr-only" htmlFor="estado">
          Estado
        </label>
        <select id="estado" name="estado" defaultValue={estado} aria-label="Estado">
          <option value="">Todas</option>
          <option value="publicada">Publicadas</option>
          <option value="borrador">En revisión</option>
          <option value="oculta">Rechazadas</option>
        </select>
        <button type="submit" className="boton-buscar">
          Buscar
        </button>
      </form>
      {aviso && <p className="aviso aviso-error">{aviso}</p>}
      {!aviso && total > 0 && (
        <p className="text-sm text-ink-soft">
          {total === 1 ? '1 reseña' : `${total} reseñas`}
        </p>
      )}
      {!aviso && filas.length === 0 && <p className="text-sm text-ink-soft">Sin resultados.</p>}
      <div className="space-y-3">
        {filas.map((fila) => (
          <ResenaAdmin key={fila.id} fila={fila} />
        ))}
      </div>
      <Paginacion pagina={pagina} paginas={paginas} href={(n) => hrefLista({ q, estado, pagina: n })} />
    </div>
  )
}
