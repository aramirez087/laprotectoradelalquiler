import Link from 'next/link'
import { consultarResenas, conteoPorUsuario, SinClaveAdmin, TAMANO_PAGINA_ADMIN } from '@/lib/admin'
import { Paginacion } from '@/components/paginacion'
import { ResenaAdmin } from '@/components/resena-admin'
import { etiquetaRol, formatoNumero, paginaSegura, primer } from '@/lib/util'

export const metadata = { title: 'Conteo por usuario' }

function hrefConteo(opts: { q?: string; pagina?: number }) {
  const p = new URLSearchParams()
  if (opts.q) p.set('q', opts.q)
  if (opts.pagina && opts.pagina > 1) p.set('pagina', String(opts.pagina))
  const s = p.toString()
  return s ? `/admin/conteo?${s}` : '/admin/conteo'
}

export default async function ConteoPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await props.searchParams
  const q = primer(params.q).trim()
  const autorRaw = Number(primer(params.autor))
  const autorId = Number.isInteger(autorRaw) && autorRaw > 0 ? autorRaw : null
  const pagina = paginaSegura(primer(params.pagina))

  let aviso: string | null = null

  if (autorId) {
    let filas: Awaited<ReturnType<typeof consultarResenas>>['filas'] = []
    let total = 0
    try {
      const resultado = await consultarResenas({ autorId, pagina })
      filas = resultado.filas
      total = resultado.total
    } catch (e) {
      aviso = e instanceof SinClaveAdmin ? e.message : 'No pudimos cargar las reseñas de esa cuenta.'
    }
    const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_ADMIN))
    const autor = filas[0]?.autor

    return (
      <div className="contenedor space-y-5">
        <Link href="/admin/conteo" className="text-sm text-ink-soft">
          Conteo
        </Link>
        <h1 className="text-3xl">{autor?.nombre ?? 'Reseñas de la cuenta'}</h1>
        {aviso && <p className="aviso aviso-error">{aviso}</p>}
        {!aviso && filas.length === 0 && <p className="text-sm text-ink-soft">Esta cuenta no tiene reseñas.</p>}
        <div className="space-y-3">
          {filas.map((fila) => (
            <ResenaAdmin key={fila.id} fila={fila} />
          ))}
        </div>
        <Paginacion
          pagina={pagina}
          paginas={paginas}
          href={(n) => `/admin/conteo?autor=${autorId}${n > 1 ? `&pagina=${n}` : ''}`}
        />
      </div>
    )
  }

  let filas: Awaited<ReturnType<typeof conteoPorUsuario>> = []
  try {
    filas = await conteoPorUsuario(q)
  } catch (e) {
    aviso = e instanceof SinClaveAdmin ? e.message : 'No pudimos calcular el conteo.'
  }

  const paginas = Math.max(1, Math.ceil(filas.length / TAMANO_PAGINA_ADMIN))
  const paginaVisible = Math.min(pagina, paginas)
  const visibles = filas.slice((paginaVisible - 1) * TAMANO_PAGINA_ADMIN, paginaVisible * TAMANO_PAGINA_ADMIN)

  return (
    <div className="contenedor space-y-5">
      <h1 className="text-3xl">Conteo por usuario</h1>
      <form method="GET" className="buscador" role="search">
        <label className="sr-only" htmlFor="q">
          Nombre o correo
        </label>
        <input id="q" type="search" name="q" defaultValue={q} placeholder="Nombre o correo" />
        <button type="submit" className="mr-1.5 rounded-full px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink">
          Buscar
        </button>
      </form>
      {aviso && <p className="aviso aviso-error">{aviso}</p>}
      {!aviso && visibles.length === 0 && <p className="text-sm text-ink-soft">Nadie tiene reseñas.</p>}
      {visibles.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="text-ink-soft">
              <tr>
                <th className="py-2 pr-3 font-medium">Cuenta</th>
                <th className="py-2 pr-3 font-medium">Total</th>
                <th className="py-2 pr-3 font-medium">Publicadas</th>
                <th className="py-2 pr-3 font-medium">En revisión</th>
                <th className="py-2 pr-3 font-medium">Rechazadas</th>
                <th className="py-2 font-medium">
                  <span className="sr-only">Abrir</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((fila) => (
                <tr key={fila.id} className="border-t border-line">
                  <td className="py-3 pr-3">
                    <p>{fila.nombre}</p>
                    <p className="text-xs text-ink-soft">
                      {etiquetaRol(fila.rol)}
                      {fila.activo ? '' : ' · inactiva'} · {fila.email}
                    </p>
                  </td>
                  <td className="py-3 pr-3">{formatoNumero(fila.total)}</td>
                  <td className="py-3 pr-3">{formatoNumero(fila.publicadas)}</td>
                  <td className="py-3 pr-3">{formatoNumero(fila.revision)}</td>
                  <td className="py-3 pr-3">{formatoNumero(fila.rechazadas)}</td>
                  <td className="py-3 text-right">
                    <Link href={`/admin/conteo?autor=${fila.id}`} className="text-sm font-medium">
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Paginacion pagina={paginaVisible} paginas={paginas} href={(n) => hrefConteo({ q, pagina: n })} />
    </div>
  )
}
