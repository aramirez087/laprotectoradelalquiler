import Link from 'next/link'
import { notFound, unstable_rethrow } from 'next/navigation'
import { CabeceraAdmin } from '@/components/admin-ui'
import { FormUsuario } from '@/components/admin-formularios'
import { FormDatosUsuarioAdmin } from '@/components/form-datos-usuario-admin'
import { FormInvitacionAdmin } from '@/components/form-invitacion-admin'
import { PerfilFacebook } from '@/components/perfil-facebook'
import { obtenerCuentaAdmin, SinClaveAdmin } from '@/lib/admin'
import { correoResenasConfigurado } from '@/lib/correo-resenas'
import { etiquetaRol, primer, regresoUsuarios } from '@/lib/util'

export const metadata = { title: 'Administrar cuenta' }

const ACCIONES: Record<string, string> = {
  permisos: 'Cambio de permisos', perfil: 'Corrección de datos',
  activacion_login: 'Inicio de sesión creado', elevacion_admin: 'Administración aceptada',
  invitacion_creada: 'Invitación creada', invitacion_renovada: 'Invitación renovada',
  invitacion_revocada: 'Invitación cancelada',
}

function descripcionCambio(valores: Record<string, unknown> | null) {
  if (!valores) return 'Sin datos anteriores'
  return Object.entries(valores).filter(([clave]) => ['rol', 'activo', 'nombre', 'identificacion', 'telefono', 'proposito'].includes(clave))
    .map(([clave, valor]) => {
      if (clave === 'rol') return `Rol: ${etiquetaRol(valor as Parameters<typeof etiquetaRol>[0])}`
      if (clave === 'activo') return valor ? 'Cuenta activa' : 'Cuenta inactiva'
      const etiquetas: Record<string, string> = { nombre: 'Nombre', identificacion: 'Cédula', telefono: 'Teléfono', proposito: 'Tipo de invitación' }
      return `${etiquetas[clave]}: ${valor ?? 'Sin registrar'}`
    }).join(' · ') || 'Cambio registrado'
}

export default async function CuentaAdminPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id: raw } = await params
  const id = Number(raw)
  if (!Number.isSafeInteger(id) || id <= 0) notFound()
  const query = await searchParams
  const regreso = primer(query.regresar)
  const regresar = regresoUsuarios(regreso) ?? '/admin/usuarios'
  let cuenta: Awaited<ReturnType<typeof obtenerCuentaAdmin>> = null
  let aviso: string | null = null
  try { cuenta = await obtenerCuentaAdmin(id) }
  catch (error) {
    unstable_rethrow(error)
    aviso = error instanceof SinClaveAdmin ? error.message : 'No pudimos cargar esta cuenta. Vuelva a intentar.'
  }
  if (!aviso && !cuenta) notFound()
  if (!cuenta) return <div className="contenedor space-y-5"><CabeceraAdmin titulo="Cuenta" descripcion="Datos y cambios de la cuenta." /><p role="alert" className="aviso aviso-error">{aviso}</p><Link href={regresar} className="btn-secundario">Volver a usuarios</Link></div>
  return (
    <div className="contenedor space-y-6">
      <Link href={regresar} className="enlace-texto inline-flex min-h-11 items-center">← Volver a usuarios</Link>
      <CabeceraAdmin titulo={cuenta.nombre} descripcion="Revise la cuenta, corrija sus datos y consulte el historial de administración." />
      <section className="expediente space-y-4" aria-label="Estado de la cuenta">
        <p className="break-words text-sm text-ink-soft">{cuenta.email}</p>
        <div className="flex flex-wrap gap-2">
          <span className="chip">{etiquetaRol(cuenta.rol)}</span>
          <span className={cuenta.activo ? 'chip chip-ok' : 'chip chip-alerta'}>{cuenta.activo ? 'Cuenta activa' : 'Cuenta inactiva'}</span>
          <span className="chip">{cuenta.tieneLogin ? 'Inicio de sesión creado' : cuenta.esLegacy ? 'Autor histórico' : 'Sin inicio de sesión'}</span>
        </div>
        <p className="text-sm leading-6 text-ink-soft">{cuenta.registro}</p>
        {cuenta.facebook && <PerfilFacebook valor={cuenta.facebook} className="enlace-texto" />}
        <Link href={`/admin/conteo?${new URLSearchParams({ autor: String(id), regresar })}`} className="btn-secundario">Ver reseñas</Link>
      </section>
      <section className="expediente space-y-5" aria-labelledby="datos-cuenta">
        <h2 id="datos-cuenta" className="text-xl">Datos de la cuenta</h2>
        <p className="text-sm leading-6 text-ink-soft">Las invitaciones de acceso se envían al correo que identifica esta cuenta.</p>
        <FormDatosUsuarioAdmin id={id} nombre={cuenta.nombre} identificacion={cuenta.identificacion} telefono={cuenta.telefono} version={cuenta.actualizado_en} />
      </section>
      <section className="expediente space-y-4" aria-labelledby="permisos-cuenta">
        <h2 id="permisos-cuenta" className="text-xl">Permisos</h2>
        <FormUsuario id={id} nombre={cuenta.nombre} rol={cuenta.rol} activo={cuenta.activo} version={cuenta.actualizado_en} />
      </section>
      {!cuenta.esLegacy && cuenta.activo && (!cuenta.tieneLogin || cuenta.rol !== 'admin') && (
        <details className="expediente space-y-4">
          <summary className="cursor-pointer py-2 font-semibold">{cuenta.tieneLogin ? 'Invitar a administrar' : 'Crear inicio de sesión'}</summary>
          <FormInvitacionAdmin habilitada={correoResenasConfigurado()} embedded initialNombre={cuenta.nombre} initialEmail={cuenta.email} proposito={cuenta.tieneLogin ? 'administracion' : 'acceso'} />
        </details>
      )}
      <section className="expediente space-y-5" aria-labelledby="historial-cuenta">
        <div><h2 id="historial-cuenta" className="text-xl">Historial de administración</h2><p className="mt-2 text-sm text-ink-soft">Los últimos 20 cambios registrados, del más reciente al más antiguo.</p></div>
        {!cuenta.historial.length ? <p className="text-sm text-ink-soft">Aún no hay cambios registrados desde que se habilitó este historial.</p> : (
          <ol className="space-y-5">
            {cuenta.historial.map(cambio => <li key={cambio.id} className="border-t border-line pt-4">
              <p className="font-semibold">{ACCIONES[cambio.accion] ?? 'Cambio de administración'}</p>
              <p className="mt-1 break-words text-sm text-ink-soft">{cambio.actor_nombre} · <time dateTime={cambio.creado_en}>{new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Costa_Rica' }).format(new Date(cambio.creado_en))}</time></p>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="font-semibold">Antes</dt><dd className="mt-1 break-words text-ink-soft">{descripcionCambio(cambio.antes)}</dd></div>
                <div><dt className="font-semibold">Después</dt><dd className="mt-1 break-words text-ink-soft">{descripcionCambio(cambio.despues)}</dd></div>
              </dl>
            </li>)}
          </ol>
        )}
      </section>
    </div>
  )
}
