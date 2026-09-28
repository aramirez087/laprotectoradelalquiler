'use client'

import { useState } from 'react'
import { useFormAction } from '@/components/use-form-action'
import { MensajeForm } from '@/components/mensaje-form'
import { invitarAdminAction } from '@/lib/actions/invitaciones'

function EnlaceInvitacion({ enlace, email }: { enlace: string; email: string }) {
  const [aviso, setAviso] = useState('')
  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace)
      setAviso('Enlace copiado.')
    } catch {
      setAviso('Seleccione el enlace y cópielo manualmente.')
    }
  }
  return (
    <div className="space-y-2 rounded border border-seal/30 p-4">
      <label htmlFor="invitacion-enlace" className="etiqueta-campo">Enlace para {email}</label>
      <input id="invitacion-enlace" className="campo" readOnly value={enlace} onFocus={(e) => e.currentTarget.select()} />
      <button type="button" onClick={copiar} className="btn-secundario">Copiar enlace</button>
      <p aria-live="polite" className="text-sm">{aviso}</p>
      <p className="text-sm text-ink-soft">Envíelo desde su propio correo únicamente a {email}. Este enlace permite activar una cuenta de administración. Es de un solo uso; si vence, genere otro.</p>
    </div>
  )
}

export function FormInvitacionAdmin({ habilitada }: { habilitada: boolean }) {
  const { estado, pendiente, formProps } = useFormAction(invitarAdminAction, { resetOnSuccess: true })
  return (
    <section className="expediente space-y-3">
      <h2 className="text-xl">Invitar administrador</h2>
      <p className="text-sm text-ink-soft">Genere un enlace y envíelo desde su propio correo, sin contratar ningún servicio. La persona invitada elegirá su clave y tendrá acceso de administración sin escribir una reseña. Generar otro enlace para el mismo correo reemplaza el anterior.</p>
      <form {...formProps} className="space-y-3">
        <fieldset disabled={pendiente} className="space-y-3">
          <div><label htmlFor="invitacion-nombre" className="etiqueta-campo">Nombre completo</label><input id="invitacion-nombre" name="nombre" className="campo" required minLength={3} maxLength={150} autoComplete="off" /></div>
          <div><label htmlFor="invitacion-email" className="etiqueta-campo">Correo electrónico</label><input id="invitacion-email" name="email" type="email" className="campo" required autoComplete="off" /></div>
          <label className={`flex items-center gap-2 text-sm ${habilitada ? '' : 'text-ink-soft opacity-60'}`}>
            <input type="checkbox" name="enviarPorCorreo" value="1" disabled={!habilitada} aria-describedby="invitacion-correo-ayuda" />
            Enviar también por correo automáticamente
          </label>
          <p id="invitacion-correo-ayuda" className="text-xs text-ink-soft">{habilitada ? 'Opcional. Se enviará mediante Resend.' : 'Resend aún no está configurado. El envío automático está deshabilitado; puede generar y copiar el enlace.'}</p>
          <button className="btn-primario">{pendiente ? 'Generando…' : 'Generar invitación'}</button>
        </fieldset>
        <MensajeForm error={estado?.error} mensaje={estado?.mensaje} />
        {estado?.advertencia && <p className="aviso aviso-error" role="alert">{estado.advertencia}</p>}
      </form>
      {estado?.invitacion && <EnlaceInvitacion key={estado.invitacion.enlace} {...estado.invitacion} />}
    </section>
  )
}
