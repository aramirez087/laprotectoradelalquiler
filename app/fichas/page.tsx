import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Paginacion } from '@/components/paginacion'
import { EsperaAprobacion } from '@/components/espera-aprobacion'
import { requireUsuario, obtenerLookups, buscarFichas, puedeConsultar } from '@/lib/dal'
import { formatoNumero, paginaSegura, primer } from '@/lib/util'
import { BuscadorFichas } from '@/components/buscador-fichas'
import { TarjetaFicha } from '@/components/tarjeta-ficha'
import { EstadoVacio } from '@/components/estado-vacio'
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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-3">Registro de la comunidad</p>
          <h1 className="text-3xl sm:text-4xl">Consultar fichas</h1>
          <p className="mt-3 text-sm text-ink-soft">
            Busque una persona para conocer las experiencias compartidas.
          </p>
        </div>
        <Link href="/resenas/nueva" className="btn-secundario">
          Escribir reseña
        </Link>
      </header>
      <BuscadorFichas q={q} provincia={provincia} provincias={provincias} />
      {(q || provincia) && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-ink-soft">Filtros:</span>
          {q && <span className="chip max-w-full break-words">“{q}”</span>}
          {provincia && (
            <span className="chip">
              {provincias.find((p) => String(p.id) === provincia)?.nombre ?? 'Provincia seleccionada'}
            </span>
          )}
          <Link href="/fichas" className="enlace-texto">
            Quitar filtros
          </Link>
        </div>
      )}

      {aviso && <p className="aviso aviso-atencion">{aviso}</p>}

      {!aviso && total > 0 && (
        <p className="text-sm text-ink-soft">
          {desde}–{hasta} de {formatoNumero(total)} {total === 1 ? 'ficha' : 'fichas'}
        </p>
      )}

      {fichas.length === 0 && !aviso ? (
        <EstadoVacio
          titulo="No encontramos fichas"
          texto="Pruebe con un apellido, revise el documento o busque en todas las provincias."
        >
          {(q || provincia) && (
            <Link href="/fichas" className="btn-secundario">
              Quitar filtros
            </Link>
          )}
          <Link href="/resenas/nueva" className="enlace-texto">
            Compartir una experiencia
          </Link>
        </EstadoVacio>
      ) : fichas.length === 0 ? null : (
        <ul className="space-y-3" aria-label="Resultados de la búsqueda">
          {fichas.map((ficha) => (
            <li key={ficha.persona.id}>
              <TarjetaFicha ficha={ficha} href={hrefFicha(ficha.persona.id, { ...filtros, pagina })} />
            </li>
          ))}
        </ul>
      )}

      <Paginacion pagina={pagina} paginas={paginas} href={(n) => hrefLista({ ...filtros, pagina: n })} />
    </div>
  )
}
