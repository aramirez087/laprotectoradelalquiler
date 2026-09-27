import Link from 'next/link'
import { requireUsuario, obtenerLookups, buscarFichas } from '@/lib/dal'
import { fechaCorta, nombreCompleto } from '@/lib/util'
import { CalificacionEstrellas } from '@/components/calificacion-estrellas'
import { Avatar } from '@/components/avatar'
import type { VistaFicha } from '@/lib/tipos'

export const metadata = { title: 'Fichas' }

function primer(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v) ?? ''
}

function hrefLista(opts: { q?: string; provincia?: string; pagina?: number }) {
  const p = new URLSearchParams()
  if (opts.q) p.set('q', opts.q)
  if (opts.provincia) p.set('provincia', opts.provincia)
  if (opts.pagina && opts.pagina > 1) p.set('pagina', String(opts.pagina))
  const s = p.toString()
  return s ? `/fichas?${s}` : '/fichas'
}

function hrefFicha(id: number, opts: { q?: string; provincia?: string; pagina?: number }) {
  const p = new URLSearchParams()
  if (opts.q) p.set('q', opts.q)
  if (opts.provincia) p.set('provincia', opts.provincia)
  if (opts.pagina && opts.pagina > 1) p.set('pagina', String(opts.pagina))
  const s = p.toString()
  return s ? `/fichas/${id}?${s}` : `/fichas/${id}`
}

function ventana(actual: number, total: number) {
  const nums = new Set<number>([1, total])
  for (let n = actual - 2; n <= actual + 2; n += 1) nums.add(n)
  return [...nums].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b)
}

export default async function FichasPage(props: PageProps<'/fichas'>) {
  await requireUsuario()
  const searchParams = await props.searchParams
  const q = primer(searchParams.q).trim()
  const provincia = primer(searchParams.provincia)
  const paginaRaw = Number(primer(searchParams.pagina) || 1)
  const pagina = Number.isFinite(paginaRaw) && paginaRaw > 0 ? Math.floor(paginaRaw) : 1

  let fichas: VistaFicha[] = []
  let total = 0
  let aviso: string | null = null
  let provincias: { id: number; nombre: string }[] = []

  try {
    const resultado = await buscarFichas({ q, provincia: provincia || undefined, pagina })
    fichas = resultado.fichas
    total = resultado.total
  } catch {
    aviso = 'No pudimos consultar el registro. Intente de nuevo en un momento.'
  }

  try {
    provincias = (await obtenerLookups()).provincias
  } catch {
    if (!aviso) aviso = 'No pudimos cargar las provincias. La búsqueda por nombre sigue disponible.'
  }

  const porPagina = 20
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  const desde = fichas.length === 0 ? 0 : (pagina - 1) * porPagina + 1
  const hasta = (pagina - 1) * porPagina + fichas.length
  const filtros = { q, provincia }

  return (
    <div className="contenedor space-y-5">
      <h1 className="sr-only">Fichas</h1>
      <form method="GET" className="buscador" role="search">
        <label className="sr-only" htmlFor="q">
          Nombre o cédula
        </label>
        <input id="q" type="search" name="q" defaultValue={q} placeholder="Nombre o cédula" />
        <label className="sr-only" htmlFor="provincia">
          Provincia
        </label>
        <select id="provincia" name="provincia" defaultValue={provincia} aria-label="Provincia">
          <option value="">Costa Rica</option>
          {provincias.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <button type="submit" className="mr-1.5 rounded-full px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink">
          Buscar
        </button>
      </form>

      {aviso && <p className="aviso aviso-atencion">{aviso}</p>}

      {!aviso && total > 0 && (
        <p className="text-sm text-ink-soft">
          {desde}–{hasta} de {total}
        </p>
      )}

      {fichas.length === 0 && !aviso ? (
        <p className="text-sm text-ink-soft">Sin resultados.</p>
      ) : fichas.length === 0 ? null : (
        <ul className="space-y-3">
          {fichas.map((ficha) => {
            const persona = ficha.persona
            const nombre = nombreCompleto(persona)
            return (
              <li key={persona.id}>
                <Link href={hrefFicha(persona.id, { ...filtros, pagina })} className="expediente flex items-center gap-4">
                  <Avatar nombre={nombre} fotoUrl={persona.foto_url} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-xl">{nombre}</p>
                    <p className="text-xs text-ink-soft">
                      {[
                        ficha.provincia,
                        ficha.resenas === 0 ? null : ficha.resenas === 1 ? '1 reseña' : `${ficha.resenas} reseñas`,
                        fechaCorta(ficha.ultima),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <CalificacionEstrellas valor={ficha.promedio} />
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {paginas > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Páginas">
          {pagina > 1 ? (
            <Link href={hrefLista({ ...filtros, pagina: pagina - 1 })} className="btn-secundario">
              Anterior
            </Link>
          ) : (
            <span className="px-3 text-sm text-ink-soft">Anterior</span>
          )}
          {ventana(pagina, paginas).map((n, i, lista) => {
            const previo = lista[i - 1]
            const salto = previo != null && n - previo > 1
            return (
              <span key={n} className="contents">
                {salto && <span className="px-1 text-ink-soft">…</span>}
                <Link
                  href={hrefLista({ ...filtros, pagina: n })}
                  aria-current={n === pagina ? 'page' : undefined}
                  className={n === pagina ? 'btn-primario' : 'btn-secundario'}
                >
                  {n}
                </Link>
              </span>
            )
          })}
          {pagina < paginas ? (
            <Link href={hrefLista({ ...filtros, pagina: pagina + 1 })} className="btn-secundario">
              Siguiente
            </Link>
          ) : (
            <span className="px-3 text-sm text-ink-soft">Siguiente</span>
          )}
        </nav>
      )}
    </div>
  )
}
