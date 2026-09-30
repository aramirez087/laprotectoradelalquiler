'use client'

import { useId, useState } from 'react'
import { useFormAction } from '@/components/use-form-action'
import { MensajeForm } from '@/components/mensaje-form'
import { invitarAdminAction } from '@/lib/actions/invitaciones'

type PropositoInvitacion = 'administracion' | 'acceso'

function fechaInvitacion(valor: string) {
  return new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Costa_Rica' }).format(new Date(valor))
}

function EnlaceInvitacion({ enlace, email, venceEn, proposito }: { enlace: string; email: string; venceEn: string; proposito: PropositoInvitacion }) {
  const [aviso, setAviso] = useState('')
  const identificador = useId()
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
      <label htmlFor={`${identificador}-enlace`} className="etiqueta-campo break-words">Enlace para {email}</label>
      <input id={`${identificador}-enlace`} className="campo" readOnly value={enlace} spellCheck={false} autoComplete="off" aria-describedby={`${identificador}-ayuda`} onFocus={(event) => event.currentTarget.select()} />
      <button type="button" onClick={copiar} className="btn-secundario w-full sm:w-auto">Copiar enlace</button>
      <p role="status" className="text-sm text-seal">{aviso}</p>
      <p id={`${identificador}-ayuda`} className="break-words text-sm leading-6 text-ink-soft">Compártalo únicamente con {email}. {proposito === 'administracion' ? 'Al aceptarlo, esta persona tendrá permisos de administración.' : 'Al aceptarlo, esta persona podrá iniciar sesión con su rol actual.'} Es de un solo uso.</p>
      <p className="text-sm text-ink-soft">Vence como máximo el <time dateTime={venceEn}>{fechaInvitacion(venceEn)}</time> (hora de Costa Rica). La configuración de autenticación puede acortar este plazo.</p>
    </div>
  )
}

export function FormInvitacionAdmin({ habilitada, embedded = false, initialNombre = '', initialEmail = '', proposito = 'administracion', renovar = false }: {
  habilitada: boolean
  embedded?: boolean
  initialNombre?: string
  initialEmail?: string
  proposito?: PropositoInvitacion
  renovar?: boolean
}) {
  const identificador = useId()
  const { estado, pendiente, formProps } = useFormAction(invitarAdminAction, { resetOnSuccess: true })
  const administra = proposito === 'administracion'
  return (
    <section className={embedded ? 'space-y-4' : 'expediente space-y-4'} aria-labelledby={`${identificador}-titulo`}>
      <div>
        <h3 id={`${identificador}-titulo`} className="text-lg font-medium">{renovar ? 'Renovar invitación' : administra ? 'Invitar a administrar' : 'Crear inicio de sesión'}</h3>
        <p className="mt-2 text-sm leading-6 text-ink-soft">{administra ? 'La persona elegirá su clave y aceptará los permisos para administrar usuarios y reseñas. No necesita aportar una reseña.' : 'La persona elegirá una clave para entrar a su cuenta. Conservará su rol y sus permisos actuales.'} Un enlace nuevo reemplaza cualquier invitación pendiente para ese correo.</p>
      </div>
      <form {...formProps} className="space-y-4">
        <input type="hidden" name="proposito" value={proposito} />
        <fieldset disabled={pendiente} className="space-y-4">
          <legend className="sr-only">Datos de la persona invitada</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor={`${identificador}-nombre`} className="etiqueta-campo">Nombre completo</label><input id={`${identificador}-nombre`} name="nombre" className="campo" required minLength={3} maxLength={150} defaultValue={initialNombre} autoComplete="off" /></div>
            <div><label htmlFor={`${identificador}-email`} className="etiqueta-campo">Correo electrónico</label><input id={`${identificador}-email`} name="email" type="email" className="campo" required defaultValue={initialEmail} autoComplete="off" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} /></div>
          </div>
          <div>
            <label className={`flex min-h-11 items-center gap-3 text-sm ${habilitada ? 'cursor-pointer' : 'text-ink-soft'}`}>
              <input type="checkbox" name="enviarPorCorreo" value="1" className="h-4 w-4 shrink-0" disabled={!habilitada} aria-describedby={`${identificador}-correo-ayuda`} />
              Enviar también por correo automáticamente
            </label>
            <p id={`${identificador}-correo-ayuda`} className="text-xs leading-6 text-ink-soft">{habilitada ? 'Opcional. La persona recibirá el enlace en el correo indicado.' : 'El envío automático no está disponible. Genere y copie el enlace para compartirlo.'}</p>
          </div>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-line p-3 text-sm leading-6">
            <input type="checkbox" name="confirmar" value="1" required className="mt-1 h-4 w-4 shrink-0" />
            <span>{administra ? 'Confirmo que quiero conceder permisos de administración a la persona de este correo cuando acepte la invitación.' : 'Confirmo que este correo pertenece a la persona que accederá a la cuenta.'}</span>
          </label>
          <button className="btn-primario w-full sm:w-auto">{pendiente ? 'Generando…' : renovar ? 'Generar nuevo enlace' : administra ? 'Generar invitación de administración' : 'Generar enlace de acceso'}</button>
        </fieldset>
        <MensajeForm error={estado?.error} mensaje={estado?.mensaje} />
        {estado?.advertencia && <p className="aviso aviso-error" role="alert">{estado.advertencia}</p>}
      </form>
      {estado?.invitacion && <EnlaceInvitacion key={estado.invitacion.enlace} {...estado.invitacion} />}
    </section>
  )
}
