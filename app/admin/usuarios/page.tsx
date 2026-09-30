import Link from 'next/link'
import { redirect, unstable_rethrow } from 'next/navigation'
import { CabeceraAdmin, ResultadosAdmin, VacioAdmin } from '@/components/admin-ui'
import { FormInvitacionAdmin } from '@/components/form-invitacion-admin'
import { InvitacionesAdmin } from '@/components/invitaciones-admin'
import { FormUsuario } from '@/components/admin-formularios'
import { Paginacion } from '@/components/paginacion'
import { PerfilFacebook } from '@/components/perfil-facebook'
import { correoResenasConfigurado } from '@/lib/correo-resenas'
import { listarInvitacionesAdmin, type FilaInvitacionAdmin } from '@/lib/invitaciones-admin'
import { buscarUsuarios, SinClaveAdmin, TAMANO_PAGINA_ADMIN, type FiltroTipoUsuario, type FiltroEstadoUsuario, type FiltroLoginUsuario, type FiltroRolUsuario } from '@/lib/admin'
import { etiquetaRol, fechaCorta, formatoNumero, paginaSegura, primer } from '@/lib/util'

export const metadata = { title: 'Usuarios' }

function hrefLista(opts: { q?: string; pagina?: number; tipo?: FiltroTipoUsuario; estado?: FiltroEstadoUsuario; login?: FiltroLoginUsuario; rol?: FiltroRolUsuario }) {
  const p = new URLSearchParams()
  if (opts.q) p.set('q', opts.q)
  if (opts.tipo && opts.tipo !== 'cuentas') p.set('tipo', opts.tipo)
  if (opts.estado && opts.estado !== 'todos') p.set('estado', opts.estado)
  if (opts.login && opts.login !== 'todos') p.set('login', opts.login)
  if (opts.rol && opts.rol !== 'todos') p.set('rol', opts.rol)
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
  const rolParam = primer(params.rol)
  const tipo: FiltroTipoUsuario = tipoParam === 'legacy' || tipoParam === 'todos' ? tipoParam : 'cuentas'
  const estado: FiltroEstadoUsuario = estadoParam === 'activas' || estadoParam === 'inactivas' ? estadoParam : 'todos'
  const login: FiltroLoginUsuario = loginParam === 'creado' || loginParam === 'pendiente' ? loginParam : 'todos'
  const rol: FiltroRolUsuario = rolParam === 'admin' || rolParam === 'propietario' || rolParam === 'agencia' || rolParam === 'inquilino' ? rolParam : 'todos'
  const filtros = { q, tipo, estado, login, rol }
  const hayFiltros = Boolean(q || estado !== 'todos' || login !== 'todos' || rol !== 'todos')

  let filas: Awaited<ReturnType<typeof buscarUsuarios>>['filas'] = []
  let resumen: Awaited<ReturnType<typeof buscarUsuarios>>['resumen'] | null = null
  let total = 0
  let aviso: string | null = null
  let invitaciones: FilaInvitacionAdmin[] = []
  let avisoInvitaciones: string | null = null
  const [usuariosResultado, invitacionesResultado] = await Promise.allSettled([
    buscarUsuarios({ ...filtros, pagina }),
    listarInvitacionesAdmin(),
  ])
  if (usuariosResultado.status === 'fulfilled') {
    filas = usuariosResultado.value.filas
    total = usuariosResultado.value.total
    resumen = usuariosResultado.value.resumen
  } else {
    unstable_rethrow(usuariosResultado.reason)
    aviso = usuariosResultado.reason instanceof SinClaveAdmin ? usuariosResultado.reason.message : 'No pudimos cargar los usuarios. Intente actualizar la página.'
  }
  if (invitacionesResultado.status === 'fulfilled') invitaciones = invitacionesResultado.value
  else {
    unstable_rethrow(invitacionesResultado.reason)
    avisoInvitaciones = 'No pudimos cargar las invitaciones. Actualice la página para volver a intentarlo.'
  }

  const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_ADMIN))
  if (!aviso && pagina > paginas) redirect(hrefLista({ ...filtros, pagina: paginas }))
  const hrefActual = hrefLista({ ...filtros, pagina })
  function hrefInvitar(id: number | 'nuevo', proposito: 'acceso' | 'administracion' = 'administracion') {
    const query = new URLSearchParams(hrefActual.split('?')[1])
    query.set('invitar', String(id))
    query.set('proposito', proposito)
    return `/admin/usuarios?${query}#invitaciones`
  }
  const invitarParam = primer(params.invitar)
  const renovarParam = primer(params.renovarInvitacion)
  const perfilInvitado = filas.find((usuario) => String(usuario.id) === invitarParam)
  const renovada = invitaciones.find((invitacion) => invitacion.id === renovarParam)
  const proposito = primer(params.proposito) === 'acceso' ? 'acceso' : 'administracion'
  const porPaginaInvitaciones = 10
  const paginaInvitaciones = Math.min(paginaSegura(primer(params.paginaInvitaciones)), Math.max(1, Math.ceil(invitaciones.length / porPaginaInvitaciones)))
  const invitacionesVisibles = invitaciones.slice((paginaInvitaciones - 1) * porPaginaInvitaciones, paginaInvitaciones * porPaginaInvitaciones)
  const correoHabilitado = correoResenasConfigurado()

  return (
    <div className="contenedor space-y-6">
      <CabeceraAdmin titulo="Usuarios" descripcion="Encuentre una cuenta, revise su acceso y gestione sus permisos." accion={<Link href={hrefInvitar('nuevo')} className="btn-primario">Invitar a administrar <span aria-hidden="true">↗</span></Link>} />
      {resumen && <section className="space-y-3" aria-label="Resumen de usuarios">
        <nav className="flex flex-wrap gap-2" aria-label="Tipo de perfil">
          {([
            ['cuentas', 'Cuentas reales', resumen.cuentas],
            ['legacy', 'Autores legacy', resumen.legacy],
            ['todos', 'Todos los perfiles', resumen.cuentas + resumen.legacy],
          ] as const).map(([valor, etiqueta, cantidad]) => <Link key={valor} href={hrefLista({ ...filtros, tipo: valor })} aria-current={tipo === valor ? 'page' : undefined} className={tipo === valor ? 'btn-primario' : 'btn-secundario'}>{etiqueta} <span className="tabular-nums">{formatoNumero(cantidad)}</span></Link>)}
        </nav>
        <details className="expediente detalles-admin resumen-usuarios">
          <summary><span>Resumen de cuentas <span className="ml-2 font-normal text-ink-soft">{formatoNumero(resumen.activas)} activas · {formatoNumero(resumen.sinLogin)} sin inicio de sesión</span></span><span className="indicador-admin" aria-hidden="true">⌄</span></summary>
          <div className="mt-4 space-y-4 border-t border-line pt-4">
            <p className="text-sm leading-6 text-ink-soft">Totales generales de cuentas reales, independientes de los filtros. El inicio de sesión, la activación y el permiso para consultar fichas son estados diferentes.</p>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {([['Cuentas activas', resumen.activas], ['Cuentas inactivas', resumen.inactivas], ['Inicio de sesión creado', resumen.conLogin], ['Sin inicio de sesión', resumen.sinLogin]] as const).map(([etiqueta, cantidad]) => <div key={etiqueta}><dt className="text-xs font-semibold text-ink-soft">{etiqueta}</dt><dd className="mt-1 text-2xl tabular-nums">{formatoNumero(cantidad)}</dd></div>)}
            </dl>
          </div>
        </details>
      </section>}
      <form key={`${tipo}-${estado}-${login}-${rol}-${q}`} method="GET" className="expediente grid grid-cols-2 items-end gap-4 lg:grid-cols-4" role="search" aria-label="Buscar usuarios">
        <input type="hidden" name="tipo" value={tipo} />
        <div className="col-span-2 min-w-0 lg:col-span-4">
          <label className="etiqueta-campo" htmlFor="q">Buscar por nombre, correo, cédula o teléfono</label>
          <input id="q" type="search" name="q" defaultValue={q} placeholder="Por ejemplo, María o maria@correo.com…" autoComplete="off" spellCheck={false} className="campo" />
        </div>
        <div className="min-w-0"><label className="etiqueta-campo" htmlFor="filtro-rol">Rol</label><select id="filtro-rol" name="rol" defaultValue={rol} className="campo"><option value="todos">Todos los roles</option><option value="admin">Administradores</option><option value="propietario">Propietarios</option><option value="agencia">Agencias</option><option value="inquilino">Inquilinos · rol histórico</option></select></div>
        <div className="min-w-0"><label className="etiqueta-campo" htmlFor="estado">Estado de la cuenta</label><select id="estado" name="estado" defaultValue={estado} className="campo"><option value="todos">Todas</option><option value="activas">Activas</option><option value="inactivas">Inactivas</option></select></div>
        <div className="min-w-0"><label className="etiqueta-campo" htmlFor="login">Inicio de sesión</label><select id="login" name="login" defaultValue={login} className="campo"><option value="todos">Todos</option><option value="creado">Creado</option><option value="pendiente">Sin crear</option></select></div>
        <button type="submit" className="btn-primario">Aplicar filtros</button>
        {hayFiltros && <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-2 text-sm col-span-2 lg:col-span-4">
          {q && <><p className="min-w-0 break-words text-ink-soft">Búsqueda: «{q}»</p><Link href={hrefLista({ tipo, estado, login, rol })} className="enlace-texto">Limpiar búsqueda</Link></>}
          <Link href={hrefLista({ tipo })} className="enlace-texto">Restablecer filtros</Link>
        </div>}
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2" id="usuarios-resultados" tabIndex={-1}>
        {!aviso && <ResultadosAdmin pagina={pagina} tamano={TAMANO_PAGINA_ADMIN} total={total} unidad="usuarios" />}
        <p className="text-xs leading-6 text-ink-soft">{tipo === 'legacy' ? 'Perfiles históricos que conservan la autoría de reseñas.' : tipo === 'todos' ? 'Cuentas reales y autores del sistema anterior.' : 'Los autores históricos están en la pestaña Autores legacy.'}</p>
      </div>
      {aviso && <p className="aviso aviso-error" role="alert">{aviso}</p>}
      {!aviso && filas.length === 0 && <VacioAdmin titulo="No hay perfiles que coincidan" descripcion="Pruebe otra búsqueda o cambie los filtros de rol, estado e inicio de sesión." href={hrefLista({ tipo })} accion="Restablecer filtros" />}
      <ul className="space-y-3" aria-label="Cuentas encontradas">
        {filas.map((usuario) => {
          const hrefCuenta = `/admin/usuarios/${usuario.id}?${new URLSearchParams({ regresar: hrefActual })}`
          return <li key={usuario.id} className="expediente usuario-admin">
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
              <div className="min-w-0 flex-1 basis-64">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2"><h2 className="min-w-0 break-words text-lg">{usuario.nombre}</h2><span className="text-xs text-ink-soft">{etiquetaRol(usuario.rol)}{usuario.rol === 'inquilino' ? ' · histórico' : ''}</span>{usuario.esLegacy && <span className="chip">Autor legacy</span>}</div>
                <p className="mt-1 break-all text-sm text-ink-soft">{usuario.email}</p>
                {(usuario.identificacion || usuario.telefono) && <p className="mt-1 break-words text-xs leading-6 text-ink-soft">{[usuario.identificacion ? `Cédula: ${usuario.identificacion}` : null, usuario.telefono ? `Teléfono: ${usuario.telefono}` : null].filter(Boolean).join(' · ')}</p>}
              </div>
              <div className="flex flex-wrap gap-x-5"><Link href={hrefCuenta} className="enlace-texto" aria-label={`Ver cuenta de ${usuario.nombre}`}>Ver cuenta</Link><Link href={`/admin/conteo?${new URLSearchParams({ autor: String(usuario.id), regresar: hrefActual })}`} className="enlace-texto" aria-label={`Ver reseñas de ${usuario.nombre}`}>Ver reseñas</Link></div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-3">
              <div><dt className="mb-2 text-xs font-semibold text-ink-soft">Estado de la cuenta</dt><dd><span className={usuario.activo ? 'chip chip-ok' : 'chip chip-alerta'}>{usuario.activo ? 'Activa' : 'Inactiva'}</span></dd></div>
              <div><dt className="mb-2 text-xs font-semibold text-ink-soft">Inicio de sesión</dt><dd><span className={usuario.tieneLogin ? 'chip chip-ok' : 'chip'}>{usuario.tieneLogin ? 'Creado' : usuario.esLegacy ? 'No corresponde' : 'Sin crear'}</span></dd></div>
              <div className="col-span-2 sm:col-span-1"><dt className="mb-2 text-xs font-semibold text-ink-soft">Permiso para consultar fichas</dt><dd><span className={usuario.puedeConsultar ? 'chip chip-ok' : 'chip'}>{usuario.puedeConsultar === null ? 'Por verificar' : usuario.puedeConsultar ? 'Habilitado' : 'No habilitado'}</span></dd></div>
            </dl>
            <p className="mt-3 text-sm leading-6 text-ink-soft">{usuario.registro}</p>
            {usuario.ultimo_acceso && <p className="mt-1 text-xs text-ink-soft">Último acceso: <time dateTime={usuario.ultimo_acceso}>{fechaCorta(usuario.ultimo_acceso)}</time></p>}
            {usuario.facebook && <PerfilFacebook valor={usuario.facebook} className="enlace-texto mt-1" />}
            <details className="detalles-admin mt-3 border-t border-line pt-1">
              <summary><span>Editar permisos <span className="sr-only">de {usuario.nombre}</span></span><span className="indicador-admin" aria-hidden="true">⌄</span></summary>
              <div className="pb-1 pt-4"><FormUsuario id={usuario.id} nombre={usuario.nombre} rol={usuario.rol} activo={usuario.activo} version={usuario.actualizado_en} /></div>
            </details>
            {!usuario.esLegacy && <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line pt-1">
              {usuario.activo && !usuario.tieneLogin && <Link href={hrefInvitar(usuario.id, 'acceso')} className="enlace-texto" aria-label={`Crear inicio de sesión para ${usuario.nombre}`}>Crear inicio de sesión</Link>}
              {usuario.activo && usuario.rol !== 'admin' && <Link href={hrefInvitar(usuario.id)} className="enlace-texto" aria-label={`Invitar a administrar a ${usuario.nombre}`}>Invitar a administrar</Link>}
              {!usuario.activo && <p className="py-2 text-xs leading-6 text-ink-soft">Active la cuenta antes de enviar una invitación de acceso o de administración.</p>}
            </div>}
          </li>
        })}
      </ul>
      <Paginacion pagina={pagina} paginas={paginas} href={(n) => hrefLista({ ...filtros, pagina: n })} />
      <section id="invitaciones" className="space-y-5 border-t border-line pt-7" aria-labelledby="invitaciones-titulo">
        <div><h2 id="invitaciones-titulo" className="text-2xl">Invitaciones</h2><p className="mt-2 text-sm text-ink-soft">Siga cada invitación desde su creación hasta que la persona acepte.</p></div>
        <details className="expediente detalles-admin" open={Boolean(invitarParam || renovarParam)}>
          <summary><span>{renovarParam ? 'Renovar un enlace' : proposito === 'acceso' ? 'Crear un inicio de sesión' : 'Nueva invitación de administración'}</span><span className="indicador-admin" aria-hidden="true">⌄</span></summary>
          <div className="mt-4 border-t border-line pt-5"><FormInvitacionAdmin key={`${invitarParam}-${renovarParam}-${proposito}`} habilitada={correoHabilitado} embedded initialNombre={perfilInvitado?.nombre ?? renovada?.nombre} initialEmail={perfilInvitado?.email ?? renovada?.email} proposito={proposito} renovar={Boolean(renovarParam)} /></div>
        </details>
        {avisoInvitaciones ? <p className="aviso aviso-error" role="alert">{avisoInvitaciones}</p> : <InvitacionesAdmin filas={invitacionesVisibles} total={invitaciones.length} pagina={paginaInvitaciones} porPagina={porPaginaInvitaciones} hrefBase={hrefActual} />}
      </section>
    </div>
  )
}
