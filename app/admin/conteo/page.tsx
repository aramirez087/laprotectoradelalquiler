import { redirect, unstable_rethrow } from 'next/navigation'
import { CabeceraAdmin, ResultadosAdmin, VacioAdmin } from '@/components/admin-ui'
import Link from 'next/link'
import { consultarResenas, conteoPorUsuario, SinClaveAdmin, TAMANO_PAGINA_ADMIN } from '@/lib/admin'
import { Paginacion } from '@/components/paginacion'
import { ResenaAdmin } from '@/components/resena-admin'
import { etiquetaRol, formatoNumero, paginaSegura, primer, regresoUsuarios } from '@/lib/util'

export const metadata = { title: 'Conteo por usuario' }

function hrefConteo(opts: { q?: string; pagina?: number }) {
  const p = new URLSearchParams()
  if (opts.q) p.set('q', opts.q)
  if (opts.pagina && opts.pagina > 1) p.set('pagina', String(opts.pagina))
  const s = p.toString()
  return s ? `/admin/conteo?${s}` : '/admin/conteo'
}

function hrefAutor(autor: number, q: string, paginaLista: number, pagina = 1, regresar?: string | null) {
  const p = new URLSearchParams({ autor: String(autor) })
  if (q) p.set('q', q)
  if (paginaLista > 1) p.set('paginaLista', String(paginaLista))
  if (pagina > 1) p.set('pagina', String(pagina))
  if (regresar) p.set('regresar', regresar)
  return `/admin/conteo?${p}`
}

export default async function ConteoPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await props.searchParams
  const q = primer(params.q).trim()
  const autorRaw = Number(primer(params.autor))
  const autorId = Number.isInteger(autorRaw) && autorRaw > 0 ? autorRaw : null
  const pagina = paginaSegura(primer(params.pagina))
  const paginaLista = paginaSegura(primer(params.paginaLista))
  const regresar = regresoUsuarios(primer(params.regresar))

  let aviso: string | null = null

  if (autorId) {
    let filas: Awaited<ReturnType<typeof consultarResenas>>['filas'] = []
    let total = 0
    try {
      const resultado = await consultarResenas({ autorId, pagina })
      filas = resultado.filas
      total = resultado.total
    } catch (e) {
      unstable_rethrow(e)
      aviso = e instanceof SinClaveAdmin ? e.message : 'No pudimos cargar las reseñas de esa cuenta.'
    }
    const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_ADMIN))
    if (!aviso && pagina > paginas) redirect(hrefAutor(autorId, q, paginaLista, paginas, regresar))
    const autor = filas[0]?.autor

    return (
      <div className="contenedor space-y-7">
        <Link href={regresar ?? hrefConteo({ q, pagina: paginaLista })} className="enlace-texto">
          <span aria-hidden="true">← </span>{regresar ? 'Volver a usuarios' : 'Volver al conteo por usuario'}
        </Link>
        <CabeceraAdmin titulo={autor?.nombre ?? 'Reseñas de la cuenta'} descripcion="Todas las experiencias aportadas por esta cuenta, con su estado de publicación." />
        {aviso && <p className="aviso aviso-error" role="alert">{aviso}</p>}
        {!aviso && <ResultadosAdmin pagina={pagina} tamano={TAMANO_PAGINA_ADMIN} total={total} />}
        {!aviso && filas.length === 0 && <VacioAdmin titulo="Esta cuenta todavía no tiene reseñas" descripcion="Cuando aporte una experiencia, podrá consultarla en esta lista." />}
        <div className="space-y-5">
          {filas.map((fila) => (
            <ResenaAdmin key={fila.id} fila={fila} />
          ))}
        </div>
        <Paginacion
          pagina={pagina}
          paginas={paginas}
          href={(n) => hrefAutor(autorId, q, paginaLista, n, regresar)}
        />
      </div>
    )
  }

  let filas: Awaited<ReturnType<typeof conteoPorUsuario>> = []
  try {
    filas = await conteoPorUsuario(q)
  } catch (e) {
    unstable_rethrow(e)
    aviso = e instanceof SinClaveAdmin ? e.message : 'No pudimos calcular el conteo.'
  }

  const paginas = Math.max(1, Math.ceil(filas.length / TAMANO_PAGINA_ADMIN))
  const paginaVisible = Math.min(pagina, paginas)
  const visibles = filas.slice((paginaVisible - 1) * TAMANO_PAGINA_ADMIN, paginaVisible * TAMANO_PAGINA_ADMIN)

  return (
    <div className="contenedor space-y-7">
      <CabeceraAdmin titulo="Reseñas por usuario" descripcion="Consulte cuántas experiencias ha aportado cada cuenta y cuántas están publicadas, en revisión o rechazadas." />
      <form method="GET" className="expediente grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" role="search" aria-label="Buscar aportes por usuario">
        <div className="min-w-0"><label className="etiqueta-campo" htmlFor="q">Nombre o correo del usuario</label><input id="q" type="search" name="q" defaultValue={q} placeholder="Encuentre una cuenta" className="campo" /></div>
        <button type="submit" className="btn-primario">Buscar</button>
        {q && <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:col-span-2"><p className="min-w-0 break-words text-ink-soft">Búsqueda: «{q}»</p><Link href="/admin/conteo" className="enlace-texto">Limpiar búsqueda</Link></div>}
      </form>
      {aviso && <p className="aviso aviso-error" role="alert">{aviso}</p>}
      {!aviso && <ResultadosAdmin pagina={paginaVisible} tamano={TAMANO_PAGINA_ADMIN} total={filas.length} unidad="usuarios" />}
      {!aviso && visibles.length === 0 && <VacioAdmin titulo={q ? 'No encontramos aportes de esa cuenta' : 'Todavía no hay aportes'} descripcion={q ? 'Pruebe otra búsqueda o consulte todas las cuentas con reseñas.' : 'Las cuentas aparecerán aquí después de aportar su primera reseña.'} href={q ? '/admin/conteo' : undefined} accion="Ver todos los aportes" />}
      <ul className="space-y-3 md:hidden">
        {visibles.map((fila) => <li key={fila.id} className="expediente space-y-4">
          <div><h2 className="text-lg">{fila.nombre}</h2><p className="mt-1 break-words text-sm text-ink-soft">{fila.email}</p><p className="mt-1 text-xs text-ink-soft">{etiquetaRol(fila.rol)}{fila.activo ? '' : ' · Cuenta inactiva'}</p></div>
          <dl className="grid grid-cols-2 gap-3 border-y border-line py-4">
            {([['Total', fila.total], ['Publicadas', fila.publicadas], ['En revisión', fila.revision], ['Rechazadas', fila.rechazadas]] as const).map(([etiqueta, cantidad]) => <div key={etiqueta}><dt className="text-xs text-ink-soft">{etiqueta}</dt><dd className="mt-1 text-xl tabular-nums">{formatoNumero(cantidad)}</dd></div>)}
          </dl>
          <Link href={hrefAutor(fila.id, q, paginaVisible)} className="btn-secundario w-full" aria-label={`Ver reseñas de ${fila.nombre}`}>Ver reseñas</Link>
        </li>)}
      </ul>
      {visibles.length > 0 && (
        <div className="hidden overflow-x-auto rounded-xl border border-line bg-card p-4 md:block" tabIndex={0} role="region" aria-label="Conteo de reseñas por usuario">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <caption className="sr-only">Reseñas por usuario y estado</caption>
            <thead className="text-ink-soft">
              <tr>
                <th scope="col" className="py-2 pr-3 font-medium">Cuenta</th>
                <th scope="col" className="py-2 pr-3 font-medium">Total</th>
                <th scope="col" className="py-2 pr-3 font-medium">Publicadas</th>
                <th scope="col" className="py-2 pr-3 font-medium">En revisión</th>
                <th scope="col" className="py-2 pr-3 font-medium">Rechazadas</th>
                <th scope="col" className="py-2 font-medium">
                  <span className="sr-only">Abrir</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((fila) => (
                <tr key={fila.id} className="border-t border-line">
                  <th scope="row" className="max-w-xs py-4 pr-4 font-normal">
                    <p className="break-words font-medium">{fila.nombre}</p>
                    <p className="break-words text-xs leading-5 text-ink-soft">
                      {etiquetaRol(fila.rol)}
                      {fila.activo ? '' : ' · inactiva'} · {fila.email}
                    </p>
                  </th>
                  <td className="py-3 pr-3">{formatoNumero(fila.total)}</td>
                  <td className="py-3 pr-3">{formatoNumero(fila.publicadas)}</td>
                  <td className="py-3 pr-3">{formatoNumero(fila.revision)}</td>
                  <td className="py-3 pr-3">{formatoNumero(fila.rechazadas)}</td>
                  <td className="py-3 text-right">
                    <Link href={hrefAutor(fila.id, q, paginaVisible)} className="enlace-texto" aria-label={`Ver reseñas de ${fila.nombre}`}>
                      Ver reseñas
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
