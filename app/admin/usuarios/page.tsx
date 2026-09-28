import { FormInvitacionAdmin } from '@/components/form-invitacion-admin'
import Link from 'next/link'
import { CabeceraAdmin, ResultadosAdmin, VacioAdmin } from '@/components/admin-ui'
import { correoResenasConfigurado } from '@/lib/correo-resenas'
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
    <div className="contenedor space-y-7">
      <CabeceraAdmin titulo="Usuarios" descripcion="Busque una cuenta para revisar sus datos, cambiar su rol o gestionar su acceso." />
      <details className="expediente denuncia">
        <summary>Invitar a una persona a administrar</summary>
        <FormInvitacionAdmin habilitada={correoResenasConfigurado()} embedded />
      </details>
      <form method="GET" className="expediente grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" role="search" aria-label="Buscar usuarios">
        <div className="min-w-0">
          <label className="etiqueta-campo" htmlFor="q">Nombre, correo, cédula o teléfono</label>
          <input id="q" type="search" name="q" defaultValue={q} placeholder="Encuentre una cuenta" className="campo" />
        </div>
        <button type="submit" className="btn-primario">Buscar</button>
        {q && <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:col-span-2"><p className="min-w-0 break-words text-ink-soft">Búsqueda: «{q}»</p><Link href="/admin/usuarios" className="enlace-texto">Limpiar búsqueda</Link></div>}
      </form>
      {aviso && <p className="aviso aviso-error" role="alert">{aviso}</p>}
      {!aviso && <ResultadosAdmin pagina={pagina} tamano={TAMANO_PAGINA_ADMIN} total={total} unidad="usuarios" />}
      {!aviso && filas.length === 0 && <VacioAdmin titulo={q ? 'No encontramos esa cuenta' : 'Todavía no hay usuarios'} descripcion={q ? 'Pruebe una parte del nombre, el correo o la cédula, o vuelva a la lista completa.' : 'Las cuentas registradas aparecerán aquí para que pueda gestionar sus permisos.'} href={q ? '/admin/usuarios' : undefined} accion="Ver todos los usuarios" />}
      <ul className="space-y-3">
        {filas.map((usuario) => (
          <li key={usuario.id} className="expediente space-y-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="min-w-0 break-words text-xl">{usuario.nombre}</h2><span className={usuario.activo ? 'chip chip-ok' : 'chip chip-alerta'}>{usuario.activo ? 'Cuenta activa' : 'Cuenta inactiva'}</span></div>
              <p className="mt-1 text-sm font-semibold text-seal">{usuario.registro}</p>
              <p className="break-words text-sm leading-6 text-ink-soft">
                {[
                  usuario.email,
                  usuario.identificacion,
                  usuario.telefono,
                  usuario.ultimo_acceso ? `último acceso ${fechaCorta(usuario.ultimo_acceso)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {usuario.facebook && (
                <a
                  href={usuario.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-seal underline-offset-2 hover:underline"
                >
                  Perfil de Facebook
                  <span className="sr-only"> (se abre en una pestaña nueva)</span>
                </a>
              )}
            </div>
            <FormUsuario id={usuario.id} rol={usuario.rol} activo={usuario.activo} />
          </li>
        ))}
      </ul>
      <Paginacion pagina={pagina} paginas={paginas} href={(n) => hrefLista({ q, pagina: n })} />
    </div>
  )
}
