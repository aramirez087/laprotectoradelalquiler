'use client'

import Link from '@/components/enlace'
import { useState } from 'react'
import { useFormAction } from '@/components/use-form-action'
import { iniciarSesion } from '@/lib/actions/auth'
import { CampoClave } from '@/components/campo-clave'
import { MensajeForm } from '@/components/mensaje-form'
import { ConfirmarCorreoForm } from '@/components/confirmar-correo-form'

export function LoginForm({
  siguiente,
  correo = '',
  enlaceFacebook = null,
  aviso = null,
  confirmarCorreo = false,
}: {
  siguiente: string
  correo?: string
  enlaceFacebook?: string | null
  aviso?: string | null
  confirmarCorreo?: boolean
}) {
  const { estado, pendiente, formProps } = useFormAction(iniciarSesion)
  const [email, setEmail] = useState(correo)
  const mismaDireccion = !estado?.email || email.trim().toLowerCase() === estado.email
  const resultado = mismaDireccion && !pendiente ? estado : undefined
  const parametros = new URLSearchParams({ siguiente })
  if (email.trim()) parametros.set('correo', email.trim())
  const recuperar = `/recuperar?${parametros}`

  if ((resultado?.confirmarCorreo || confirmarCorreo) && !pendiente) {
    return (
      <div className="space-y-5">
        <MensajeForm error={resultado?.error || aviso || undefined} />
        <ConfirmarCorreoForm key={(resultado?.email || email).trim().toLowerCase()} correo={resultado?.email || email} siguiente={siguiente} enfocar volverAlLogin />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <form {...formProps} className="space-y-4">
        {enlaceFacebook && (
          <div className="space-y-5 pb-1">
            <a className="btn-secundario flex w-full" href={enlaceFacebook}>
              Continuar con Facebook
            </a>
            <div className="flex items-center gap-3 text-xs text-ink-soft">
              <span aria-hidden="true" className="h-px flex-1 bg-line" />
              <span>o entre con su correo</span>
              <span aria-hidden="true" className="h-px flex-1 bg-line" />
            </div>
          </div>
        )}
        <input type="hidden" name="siguiente" value={siguiente} />
        <div>
          <label className="etiqueta-campo" htmlFor="email">
            Correo electrónico
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            readOnly={pendiente}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
            className="campo"
            placeholder="usted@correo.com"
          />
        </div>
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <label className="etiqueta-campo" htmlFor="clave">Clave</label>
            <Link href={recuperar} className="mb-2 inline-flex min-h-11 items-center text-sm font-medium text-seal underline underline-offset-4">
              ¿Olvidó su clave?
            </Link>
          </div>
          <CampoClave id="clave" name="clave" autoComplete="current-password" readOnly={pendiente} />
        </div>
        <MensajeForm error={pendiente ? undefined : resultado?.error || aviso || undefined} />
        {resultado?.recuperable && (
          <Link href={recuperar} className="enlace-texto font-semibold">
            Recuperar mi clave
          </Link>
        )}
        <button type="submit" disabled={pendiente} className="btn-primario w-full">
          {pendiente ? 'Entrando…' : 'Iniciar sesión'}
        </button>
        <p className="border-t border-line pt-5 text-center text-sm text-ink-soft">
          ¿No tiene cuenta?{' '}
          <Link href={`/registro?${parametros}`} className="inline-flex min-h-11 items-center font-semibold text-seal underline underline-offset-4">
            Crear una cuenta
          </Link>
        </p>
      </form>
    </div>
  )
}
