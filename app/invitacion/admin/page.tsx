import { MarcoAcceso } from '@/components/marco-acceso'
import { FormClave } from '@/components/form-clave'
import { aceptarInvitacionAction } from '@/lib/actions/invitaciones'
import { primer } from '@/lib/util'

export const metadata = { title: 'Aceptar invitación', robots: { index: false, follow: false }, referrer: 'no-referrer' as const }

export default async function InvitacionAdminPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await props.searchParams
  const id = primer(params.id)
  const token = primer(params.token)
  return (
    <MarcoAcceso titulo="Le invitamos a administrar" texto="Elija una clave para aceptar la invitación. Las cuentas de administración no necesitan escribir una reseña.">
      {id && token ? (
        <FormClave accion={aceptarInvitacionAction.bind(null, id, token)} etiqueta="Aceptar invitación" />
      ) : <p className="aviso aviso-error">El enlace está incompleto. Pida a administración una nueva invitación.</p>}
    </MarcoAcceso>
  )
}
