import Link from '@/components/enlace'
import { MarcoAcceso } from '@/components/marco-acceso'
import { FormClave } from '@/components/form-clave'
import { aceptarInvitacionAction } from '@/lib/actions/invitaciones'
import { consultarInvitacionAdmin, consultarInvitacionPendiente } from '@/lib/invitaciones-admin'
import { primer } from '@/lib/util'

export const metadata = { title: 'Aceptar invitación', robots: { index: false, follow: false }, referrer: 'no-referrer' as const }

export default async function InvitacionAdminPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await props.searchParams
  const id = primer(params.id)
  const token = primer(params.token)
  const retomando = primer(params.continuar) === '1'
  const invitacion = retomando ? await consultarInvitacionPendiente(id) : await consultarInvitacionAdmin(id, token)
  const administracion = invitacion?.proposito === 'administracion'
  return (
    <MarcoAcceso titulo={invitacion ? administracion ? 'Le invitamos a administrar' : 'Active su inicio de sesión' : 'Invitación no disponible'} texto={invitacion ? 'Elija una clave nueva para aceptar. Se cerrarán las otras sesiones de esta cuenta.' : 'Pida a administración un enlace nuevo para continuar.'}>
      {invitacion ? (
        <div className="space-y-4">
          <p className="break-words text-sm leading-relaxed text-ink-soft">Cuenta: {invitacion.email}. {administracion ? 'Recibirá permisos de administración y no necesitará escribir una reseña.' : 'Su rol y los requisitos para consultar fichas se mantienen.'}</p>
          {retomando && <p className="aviso text-sm">Identidad verificada. Vuelva a escribir la clave que desea usar para finalizar la invitación.</p>}
          <FormClave accion={aceptarInvitacionAction.bind(null, id, retomando ? '' : token)} etiqueta={administracion ? 'Aceptar administración' : 'Activar inicio de sesión'} anchoCompleto />
        </div>
      ) : (
        <div className="space-y-4">
          <p role="alert" className="aviso aviso-error">El enlace está incompleto, venció, se canceló o ya fue utilizado.</p>
          <Link href="/login" className="btn-secundario w-full">Ir a iniciar sesión</Link>
        </div>
      )}
    </MarcoAcceso>
  )
}
