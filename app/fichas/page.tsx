import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Paginacion } from '@/components/paginacion'
import { EsperaAprobacion } from '@/components/espera-aprobacion'
import { requireUsuario, obtenerLookups, buscarFichas, puedeConsultar } from '@/lib/dal'
import { fechaCorta, nombreCompleto, paginaSegura, primer } from '@/lib/util'
import { CalificacionEstrellas } from '@/components/calificacion-estrellas'
import { Avatar } from '@/components/avatar'
import type { VistaFicha } from '@/lib/tipos'

export const metadata = { title: 'Fichas' }

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

export default async function FichasPage(props: PageProps<'/fichas'>) {
  const searchParams = await props.searchParams
  const q = primer(searchParams.q).trim()
  const provincia = primer(searchParams.provincia)
  const pagina = paginaSegura(primer(searchParams.pagina))
  const usuario = await requireUsuario(hrefLista({ q, provincia, pagina }))
  if (!(await puedeConsultar(usuario))) {
    return <EsperaAprobacion usuario={usuario} />
  }

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
  if (!aviso && pagina > paginas) redirect(hrefLista({ q, provincia, pagina: paginas }))
  const desde = fichas.length === 0 ? 0 : (pagina - 1) * porPagina + 1
  const hasta = (pagina - 1) * porPagina + fichas.length
  const filtros = { q, provincia }

  return (
    <div className="contenedor space-y-5">
      <h1 className="sr-only">Fichas</h1>
      <form action="/fichas" method="GET" className="buscador" role="search">
        <label className="sr-only" htmlFor="q">
          Nombre o cédula
        </label>
        <input id="q" type="search" name="q" defaultValue={q} placeholder="Nombre o cédula" maxLength={150} />
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
        <div className="expediente py-10 text-center">
          <h2 className="text-xl">No encontramos fichas</h2>
          <p className="mt-2 text-sm text-ink-soft">Pruebe con otro nombre o cédula, o cambie la provincia.</p>
          {(q || provincia) && <Link href="/fichas" className="btn-secundario mt-5">Quitar filtros</Link>}
        </div>
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

      <Paginacion pagina={pagina} paginas={paginas} href={(n) => hrefLista({ ...filtros, pagina: n })} />
    </div>
  )
}
