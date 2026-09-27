import { redirect } from 'next/navigation'
import { buscarUsuarios, SinClaveAdmin, TAMANO_PAGINA_ADMIN } from '@/lib/admin'
import { FormUsuario } from '@/components/admin-formularios'
import { Paginacion } from '@/components/paginacion'
import { fechaCorta, paginaSegura, primer } from '@/lib/util'

export const metadata = { title: 'Usuarios' }

function hrefLista(opts: { q?: string; pagina?: number }) {
  const p = new URLSearchParams()
  if (opts.q) p.set('q', opts.q)
  if (opts.pagina && opts.pagina > 1) p.set('pagina', String(opts.pagina))
  const s = p.toString()
  return s ? `/admin/usuarios?${s}` : '/admin/usuarios'
}

export default async function UsuariosPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await props.searchParams
  const q = primer(params.q).trim()
  const pagina = paginaSegura(primer(params.pagina))

  let filas: Awaited<ReturnType<typeof buscarUsuarios>>['filas'] = []
  let total = 0
  let aviso: string | null = null
  try {
    const resultado = await buscarUsuarios({ q, pagina })
    filas = resultado.filas
    total = resultado.total
  } catch (e) {
    aviso = e instanceof SinClaveAdmin ? e.message : 'No pudimos cargar los usuarios.'
  }

  const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_ADMIN))
  if (!aviso && pagina > paginas) redirect(hrefLista({ q, pagina: paginas }))

  return (
    <div className="contenedor space-y-5">
      <h1 className="text-3xl">Usuarios</h1>
      <form method="GET" className="buscador" role="search">
        <label className="sr-only" htmlFor="q">
          Nombre, correo, cédula o teléfono
        </label>
        <input id="q" type="search" name="q" defaultValue={q} placeholder="Nombre, correo, cédula o teléfono" />
        <button type="submit" className="boton-buscar">
          Buscar
        </button>
      </form>
      {aviso && <p className="aviso aviso-error">{aviso}</p>}
      {!aviso && filas.length === 0 && <p className="text-sm text-ink-soft">Sin resultados.</p>}
      <ul className="space-y-3">
        {filas.map((usuario) => (
          <li key={usuario.id} className="expediente space-y-3">
            <div>
              <p className="text-lg">{usuario.nombre}</p>
              <p className="text-sm text-ink-soft">
                {[
                  usuario.email,
                  usuario.identificacion,
                  usuario.telefono,
                  usuario.ultimo_acceso ? `último acceso ${fechaCorta(usuario.ultimo_acceso)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <FormUsuario id={usuario.id} rol={usuario.rol} activo={usuario.activo} />
          </li>
        ))}
      </ul>
      <Paginacion pagina={pagina} paginas={paginas} href={(n) => hrefLista({ q, pagina: n })} />
    </div>
  )
}
