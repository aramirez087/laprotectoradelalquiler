import { FormInvitacionAdmin } from '@/components/form-invitacion-admin'
import Link from 'next/link'
import { CabeceraAdmin, ResultadosAdmin, VacioAdmin } from '@/components/admin-ui'
import { correoResenasConfigurado } from '@/lib/correo-resenas'
import { redirect } from 'next/navigation'
import { buscarUsuarios, SinClaveAdmin, TAMANO_PAGINA_ADMIN, type FiltroTipoUsuario, type FiltroEstadoUsuario, type FiltroLoginUsuario } from '@/lib/admin'
import { FormUsuario } from '@/components/admin-formularios'
import { Paginacion } from '@/components/paginacion'
import { etiquetaRol, fechaCorta, formatoNumero, paginaSegura, primer } from '@/lib/util'

export const metadata = { title: 'Usuarios' }

function hrefLista(opts: { q?: string; pagina?: number; tipo?: FiltroTipoUsuario; estado?: FiltroEstadoUsuario; login?: FiltroLoginUsuario }) {
  const p = new URLSearchParams()
  if (opts.q) p.set('q', opts.q)
  if (opts.tipo && opts.tipo !== 'cuentas') p.set('tipo', opts.tipo)
  if (opts.estado && opts.estado !== 'todos') p.set('estado', opts.estado)
  if (opts.login && opts.login !== 'todos') p.set('login', opts.login)
  if (opts.pagina && opts.pagina > 1) p.set('pagina', String(opts.pagina))
  const s = p.toString()
  return s ? `/admin/usuarios?${s}` : '/admin/usuarios'
}

export default async function UsuariosPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await props.searchParams
  const q = primer(params.q).trim()
  const pagina = paginaSegura(primer(params.pagina))
  const tipoParam = primer(params.tipo)
  const estadoParam = primer(params.estado)
  const loginParam = primer(params.login)
  const tipo: FiltroTipoUsuario = tipoParam === 'legacy' || tipoParam === 'todos' ? tipoParam : 'cuentas'
  const estado: FiltroEstadoUsuario = estadoParam === 'activas' || estadoParam === 'inactivas' ? estadoParam : 'todos'
  const login: FiltroLoginUsuario = loginParam === 'creado' || loginParam === 'pendiente' ? loginParam : 'todos'
  const filtros = { q, tipo, estado, login }
  const hayFiltros = Boolean(q || estado !== 'todos' || login !== 'todos')

  let filas: Awaited<ReturnType<typeof buscarUsuarios>>['filas'] = []
  let resumen: Awaited<ReturnType<typeof buscarUsuarios>>['resumen'] | null = null
  let total = 0
  let aviso: string | null = null
  try {
    const resultado = await buscarUsuarios({ ...filtros, pagina })
    filas = resultado.filas
    total = resultado.total
    resumen = resultado.resumen
  } catch (e) {
    aviso = e instanceof SinClaveAdmin ? e.message : 'No pudimos cargar los usuarios.'
  }

  const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_ADMIN))
  if (!aviso && pagina > paginas) redirect(hrefLista({ ...filtros, pagina: paginas }))

  return (
    <div className="contenedor space-y-7">
      <CabeceraAdmin titulo="Usuarios" descripcion="Revise por separado el estado de la cuenta, su inicio de sesión y el permiso para consultar fichas." />
      {resumen && (
        <section className="space-y-4" aria-label="Resumen de usuarios">
          <nav className="flex flex-wrap gap-2" aria-label="Tipo de perfil">
            {([
              ['cuentas', 'Cuentas reales', resumen.cuentas],
              ['legacy', 'Autores legacy', resumen.legacy],
              ['todos', 'Todos los perfiles', resumen.cuentas + resumen.legacy],
            ] as const).map(([valor, etiqueta, cantidad]) => (
              <Link key={valor} href={hrefLista({ ...filtros, tipo: valor })} aria-current={tipo === valor ? 'page' : undefined} className={tipo === valor ? 'btn-primario' : 'btn-secundario'}>
                {etiqueta} <span className="tabular-nums">{formatoNumero(cantidad)}</span>
              </Link>
            ))}
          </nav>
          <div className="expediente space-y-3">
            <p className="text-sm text-ink-soft">Resumen general de las cuentas reales, independiente de los filtros. Tener un inicio de sesión creado no activa la cuenta ni concede permiso para consultar.</p>
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {([
                ['Cuentas activas', resumen.activas],
                ['Cuentas inactivas', resumen.inactivas],
                ['Inicio de sesión creado', resumen.conLogin],
                ['Sin inicio de sesión', resumen.sinLogin],
              ] as const).map(([etiqueta, cantidad]) => (
                <div key={etiqueta} className="metrico">
                  <dt className="text-xs font-semibold text-ink-soft">{etiqueta}</dt>
                  <dd className="mt-1 tabular-nums">{formatoNumero(cantidad)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}
      <p className="text-sm leading-6 text-ink-soft">
        {tipo === 'cuentas'
          ? 'Se muestran las cuentas con correo real. Los perfiles históricos sin correo utilizable están en Autores legacy.'
          : tipo === 'legacy'
            ? 'Estos perfiles conservan la autoría de reseñas antiguas. Su correo es un identificador histórico y no permite recuperar una contraseña.'
            : 'Esta vista incluye las cuentas reales y los perfiles históricos usados para conservar la autoría de reseñas.'}
      </p>
      <details className="expediente denuncia">
        <summary>Invitar a una persona a administrar</summary>
        <FormInvitacionAdmin habilitada={correoResenasConfigurado()} embedded />
      </details>
      <form key={`${tipo}-${estado}-${login}-${q}`} method="GET" className="expediente grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end" role="search" aria-label="Buscar usuarios">
        <input type="hidden" name="tipo" value={tipo} />
        <div className="min-w-0">
          <label className="etiqueta-campo" htmlFor="q">Nombre, correo, cédula o teléfono</label>
          <input id="q" type="search" name="q" defaultValue={q} placeholder="Encuentre una cuenta" className="campo" />
        </div>
        <div className="min-w-0">
          <label className="etiqueta-campo" htmlFor="estado">Estado de la cuenta</label>
          <select id="estado" name="estado" defaultValue={estado} className="campo">
            <option value="todos">Todas</option>
            <option value="activas">Activas</option>
            <option value="inactivas">Inactivas</option>
          </select>
        </div>
        <div className="min-w-0">
          <label className="etiqueta-campo" htmlFor="login">Inicio de sesión</label>
          <select id="login" name="login" defaultValue={login} className="campo">
            <option value="todos">Todos</option>
            <option value="creado">Creado</option>
            <option value="pendiente">Sin crear</option>
          </select>
        </div>
        <button type="submit" className="btn-primario">Aplicar filtros</button>
        {hayFiltros && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:col-span-2 lg:col-span-4">
            {q && <><p className="min-w-0 break-words text-ink-soft">Búsqueda: «{q}»</p><Link href={hrefLista({ tipo, estado, login })} className="enlace-texto">Limpiar búsqueda</Link></>}
            <Link href={hrefLista({ tipo })} className="enlace-texto">Restablecer filtros</Link>
          </div>
        )}
      </form>
      {aviso && <p className="aviso aviso-error" role="alert">{aviso}</p>}
      {!aviso && <ResultadosAdmin pagina={pagina} tamano={TAMANO_PAGINA_ADMIN} total={total} unidad="usuarios" />}
      {!aviso && filas.length === 0 && <VacioAdmin titulo="No hay perfiles que coincidan" descripcion="Pruebe otra búsqueda o cambie los filtros de estado e inicio de sesión." href={hrefLista({ tipo })} accion="Restablecer filtros" />}
      <ul className="space-y-3">
        {filas.map((usuario) => (
          <li key={usuario.id} className="expediente space-y-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="min-w-0 break-words text-xl">{usuario.nombre}</h2>{usuario.esLegacy && <span className="chip">Autor legacy</span>}</div>
              <p className="mt-1 text-sm text-ink-soft">Rol: {etiquetaRol(usuario.rol)}{usuario.rol === 'inquilino' ? ' · Rol del sistema anterior' : ''}</p>
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
              <dl className="my-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="mb-2 text-xs font-semibold text-ink-soft">Estado de la cuenta</dt>
                  <dd><span className={usuario.activo ? 'chip chip-ok' : 'chip chip-alerta'}>{usuario.activo ? 'Activa' : 'Inactiva'}</span></dd>
                </div>
                <div>
                  <dt className="mb-2 text-xs font-semibold text-ink-soft">Inicio de sesión</dt>
                  <dd><span className={usuario.tieneLogin ? 'chip chip-ok' : 'chip'}>{usuario.tieneLogin ? 'Creado' : usuario.esLegacy ? 'No corresponde' : 'Sin crear'}</span></dd>
                </div>
                <div>
                  <dt className="mb-2 text-xs font-semibold text-ink-soft">Permiso para consultar fichas</dt>
                  <dd><span className={usuario.puedeConsultar ? 'chip chip-ok' : 'chip'}>{usuario.puedeConsultar === null ? 'Por verificar' : usuario.puedeConsultar ? 'Habilitado' : 'No habilitado'}</span></dd>
                </div>
              </dl>
              <p className="text-sm leading-6 text-ink-soft">{usuario.registro}</p>
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
            <FormUsuario key={`${usuario.id}-${usuario.rol}-${usuario.activo}`} id={usuario.id} rol={usuario.rol} activo={usuario.activo} />
          </li>
        ))}
      </ul>
      <Paginacion pagina={pagina} paginas={paginas} href={(n) => hrefLista({ ...filtros, pagina: n })} />
    </div>
  )
}
