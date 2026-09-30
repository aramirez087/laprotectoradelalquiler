'use client'

import Link from '@/components/enlace'
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
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <label className="etiqueta-campo" htmlFor="clave">Clave</label>
          <Link href="/recuperar" className="mb-2 inline-flex min-h-6 items-center text-xs font-medium text-seal underline underline-offset-4">
            ¿Olvidó su clave?
          </Link>
        </div>
        <CampoClave id="clave" name="clave" autoComplete="current-password" />
      </div>
      <MensajeForm error={estado?.error || aviso || undefined} />
      <button disabled={pendiente} className="btn-primario w-full">
        {pendiente ? 'Entrando…' : 'Iniciar sesión'}
      </button>
      <p className="border-t border-line pt-5 text-center text-sm text-ink-soft">
        ¿No tiene cuenta?{' '}
        <Link href={`/registro?${new URLSearchParams({ siguiente })}`} className="inline-flex min-h-8 items-center font-semibold text-seal underline underline-offset-4">
          Registrarse
        </Link>
      </p>
    </form>
  )
}
