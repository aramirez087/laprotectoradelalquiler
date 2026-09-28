'use client'

import { useFormAction } from '@/components/use-form-action'
import { MensajeForm } from '@/components/mensaje-form'
import { invitarAdminAction } from '@/lib/actions/invitaciones'

export function FormInvitacionAdmin({ habilitada }: { habilitada: boolean }) {
  const { estado, pendiente, formProps } = useFormAction(invitarAdminAction, { resetOnSuccess: true })
  return (
    <section className="expediente space-y-3">
      <h2 className="text-xl">Invitar administrador</h2>
      <p className="text-sm text-ink-soft">Envíe una invitación a una persona nueva. Tendrá acceso de administración al aceptarla, sin escribir una reseña. Para reenviar un enlace pendiente, complete el formulario de nuevo.</p>
      {!habilitada && <p id="invitacion-ayuda" className="aviso">Resend aún no está configurado. Las invitaciones por correo están deshabilitadas.</p>}
      <form {...formProps} className="space-y-3">
        <fieldset disabled={!habilitada || pendiente} aria-describedby={!habilitada ? 'invitacion-ayuda' : undefined} className={`space-y-3 ${habilitada ? '' : 'opacity-60'}`}>
          <div><label htmlFor="invitacion-nombre" className="etiqueta-campo">Nombre completo</label><input id="invitacion-nombre" name="nombre" className="campo" required minLength={3} maxLength={150} autoComplete="off" /></div>
          <div><label htmlFor="invitacion-email" className="etiqueta-campo">Correo electrónico</label><input id="invitacion-email" name="email" type="email" className="campo" required autoComplete="off" /></div>
          <button className="btn-primario">{pendiente ? 'Enviando…' : 'Enviar invitación de administrador'}</button>
        </fieldset>
        <MensajeForm error={estado?.error} mensaje={estado?.mensaje} />
      </form>
    </section>
  )
}
