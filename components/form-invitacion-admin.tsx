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
    <div className="space-y-3 rounded-xl border border-seal/30 bg-seal-soft/30 p-4">
      <label htmlFor="invitacion-enlace" className="etiqueta-campo break-words">Enlace para {email}</label>
      <input id="invitacion-enlace" className="campo" readOnly value={enlace} spellCheck={false} aria-describedby="invitacion-enlace-ayuda" onFocus={(e) => e.currentTarget.select()} />
      <button type="button" onClick={copiar} className="btn-secundario w-full sm:w-auto">Copiar enlace</button>
      <p role="status" className="text-sm text-seal">{aviso}</p>
      <p id="invitacion-enlace-ayuda" className="break-words text-sm leading-relaxed text-ink-soft">Compártalo únicamente con {email}. Este enlace activa una cuenta de administración y es de un solo uso. Si vence, genere otro.</p>
    </div>
  )
}

export function FormInvitacionAdmin({ habilitada, embedded = false }: { habilitada: boolean; embedded?: boolean }) {
  const { estado, pendiente, formProps } = useFormAction(invitarAdminAction, { resetOnSuccess: true })
  return (
    <section className={embedded ? 'space-y-3' : 'expediente space-y-3'}>
      <h2 className="text-xl">Invitar administrador</h2>
      <p className="text-sm leading-relaxed text-ink-soft">Genere un enlace para que la persona invitada elija su clave y acceda a administración. No necesita escribir una reseña. Si genera otro enlace para el mismo correo, el anterior dejará de funcionar.</p>
      <form {...formProps} className="space-y-3">
        <fieldset disabled={pendiente} className="space-y-3">
          <div><label htmlFor="invitacion-nombre" className="etiqueta-campo">Nombre completo</label><input id="invitacion-nombre" name="nombre" className="campo" required minLength={3} maxLength={150} autoComplete="off" /></div>
          <div><label htmlFor="invitacion-email" className="etiqueta-campo">Correo electrónico</label><input id="invitacion-email" name="email" type="email" className="campo" required autoComplete="off" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} /></div>
          <label className={`flex min-h-11 items-center gap-3 text-sm ${habilitada ? 'cursor-pointer' : 'text-ink-soft'}`}>
            <input type="checkbox" name="enviarPorCorreo" value="1" className="h-4 w-4 shrink-0" disabled={!habilitada} aria-describedby="invitacion-correo-ayuda" />
            Enviar también por correo automáticamente
          </label>
          <p id="invitacion-correo-ayuda" className="text-xs leading-relaxed text-ink-soft">{habilitada ? 'Opcional. La persona recibirá el enlace en el correo indicado.' : 'El envío automático no está disponible. Puede generar y copiar el enlace para compartirlo.'}</p>
          <button className="btn-primario w-full sm:w-auto">{pendiente ? 'Generando…' : 'Generar invitación'}</button>
        </fieldset>
        <MensajeForm error={estado?.error} mensaje={estado?.mensaje} />
        {estado?.advertencia && <p className="aviso aviso-error" role="alert">{estado.advertencia}</p>}
      </form>
      {estado?.invitacion && <EnlaceInvitacion key={estado.invitacion.enlace} {...estado.invitacion} />}
    </section>
  )
}
