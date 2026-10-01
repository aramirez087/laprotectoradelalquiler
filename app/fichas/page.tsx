import { registrarError } from '@/lib/registro-error'
import Link from '@/components/enlace'
import { redirect } from 'next/navigation'
import { Paginacion } from '@/components/paginacion'
import { EsperaAprobacion } from '@/components/espera-aprobacion'
import { requireUsuario, buscarFichas, accesoConsulta } from '@/lib/dal'
import { mensajeAcceso } from '@/lib/acceso-consulta'
import { formatoNumero, paginaSegura, primer } from '@/lib/util'
import { BuscadorFichas } from '@/components/buscador-fichas'
import { TarjetaFicha } from '@/components/tarjeta-ficha'
import { EstadoVacio } from '@/components/estado-vacio'
import type { VistaFicha } from '@/lib/tipos'
import { PrimeraConsulta } from '@/components/primera-consulta'
import { confirmarConsulta } from '@/lib/consulta-confirmada'

export const metadata = { title: 'Reseñas' }

function hrefLista(opts: { q?: string; pagina?: number }) {
  const p = new URLSearchParams()
  if (opts.q) p.set('q', opts.q)
  if (opts.pagina && opts.pagina > 1) p.set('pagina', String(opts.pagina))
  const s = p.toString()
  return s ? `/fichas?${s}` : '/fichas'
}

function hrefFicha(id: number, opts: { q?: string; pagina?: number }) {
  const p = new URLSearchParams()
  if (opts.q) p.set('q', opts.q)
  if (opts.pagina && opts.pagina > 1) p.set('pagina', String(opts.pagina))
  const s = p.toString()
  return s ? `/fichas/${id}?${s}` : `/fichas/${id}`
}

export default async function FichasPage(props: PageProps<'/fichas'>) {
  const searchParams = await props.searchParams
  const q = primer(searchParams.q).trim()
  const pagina = paginaSegura(primer(searchParams.pagina))
  const usuario = await requireUsuario(hrefLista({ q, pagina }))
  const acceso = await accesoConsulta(usuario)
  if (!acceso.puede_consultar) {
    return <EsperaAprobacion usuario={usuario} />
  }

  let fichas: VistaFicha[] = []
  let total = 0
  let aviso: string | null = null

  try {
    const resultado = await buscarFichas({ q, pagina })
    fichas = resultado.fichas
    total = resultado.total
  } catch (error) {
    registrarError('page_load_error', error, { route: '/fichas', routeType: 'render' })
    aviso = 'No pudimos consultar el registro. Intente de nuevo en un momento.'
  }

  const porPagina = 20
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  if (!aviso && pagina > paginas) redirect(hrefLista({ q, pagina: paginas }))
  const desde = fichas.length === 0 ? 0 : (pagina - 1) * porPagina + 1
  const hasta = (pagina - 1) * porPagina + fichas.length
  const filtros = { q }
  const confirmacion = q && !aviso && usuario.rol !== 'admin' ? confirmarConsulta(usuario.id) : null

  return (
    <div className="contenedor space-y-5">
      {confirmacion && <PrimeraConsulta confirmacion={confirmacion} />}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-3">Registro de propietarios y agencias</p>
          <h1 className="text-3xl sm:text-4xl">Reseñas</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
            Encuentre a un inquilino por nombre o cédula y conozca las experiencias compartidas por otros propietarios y agencias.
          </p>
        </div>
        <Link href="/resenas/nueva" className="btn-secundario">
          Escribir reseña
        </Link>
      </header>
      {acceso.vence_en && <p className="text-xs text-ink-soft">{mensajeAcceso(acceso)}</p>}
      <BuscadorFichas q={q} />
      {q && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-ink-soft">Búsqueda:</span>
          <span className="chip max-w-full break-words">“{q}”</span>
          <Link href="/fichas" className="enlace-texto">
            Quitar búsqueda
          </Link>
        </div>
      )}

      {aviso && (
        <div className="aviso aviso-atencion space-y-3" role="alert">
          <p>{aviso}</p>
          <a href={hrefLista({ q, pagina })} className="btn-secundario">Intentar de nuevo</a>
        </div>
      )}

      {!aviso && total > 0 && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg">{q ? 'Resultados de la búsqueda' : 'Fichas de la comunidad'}</h2>
          <p className="text-sm text-ink-soft">
            {desde}–{hasta} de {formatoNumero(total)} {total === 1 ? 'resultado' : 'resultados'}
          </p>
        </div>
      )}

      {fichas.length === 0 && !aviso ? (
        <EstadoVacio
          titulo={q ? 'No encontramos coincidencias' : 'Todavía no hay fichas disponibles'}
          texto={q ? 'Revise la escritura o pruebe solo con un apellido o la cédula. Que no aparezca aquí no significa que tenga un historial positivo o negativo.' : 'Las fichas reúnen experiencias de propietarios y agencias con sus inquilinos. Puede compartir la suya para contribuir al registro.'}
        >
          {q && (
            <Link href="/fichas" className="btn-secundario">
              Quitar búsqueda
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
