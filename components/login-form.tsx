'use client'

import Link from 'next/link'
import { useFormAction } from '@/components/use-form-action'
import { iniciarSesion } from '@/lib/actions/auth'
import { CampoClave } from '@/components/campo-clave'
import { MensajeForm } from '@/components/mensaje-form'

export function LoginForm({
  siguiente,
  correo = '',
  enlaceFacebook = null,
  aviso = null,
}: {
  siguiente: string
  correo?: string
  enlaceFacebook?: string | null
  aviso?: string | null
}) {
  const { estado, pendiente, formProps } = useFormAction(iniciarSesion)

  return (
    <form {...formProps} className="space-y-4">
      {enlaceFacebook && (
        <a className="btn-secundario flex w-full" href={enlaceFacebook}>
          Continuar con Facebook
        </a>
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
          defaultValue={correo}
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
        <label className="etiqueta-campo" htmlFor="clave">
          Clave
        </label>
        <CampoClave id="clave" name="clave" autoComplete="current-password" />
      </div>
      <MensajeForm error={estado?.error || aviso || undefined} />
      <button disabled={pendiente} className="btn-primario w-full">
        {pendiente ? 'Entrando…' : 'Iniciar sesión'}
      </button>
      <p className="text-center text-sm">
        <Link href="/recuperar" className="text-ink-soft underline-offset-2 hover:underline">
          ¿Olvidó su clave?
        </Link>
      </p>
      <p className="text-center text-sm text-ink-soft">
        ¿No tiene cuenta?{' '}
        <Link href={`/registro?${new URLSearchParams({ siguiente })}`} className="font-semibold text-seal underline-offset-2 hover:underline">
          Crear una cuenta
        </Link>
      </p>
    </form>
  )
}
