'use client'

import Link from 'next/link'
import { useFormAction } from '@/components/use-form-action'
import { solicitarRecuperacion } from '@/lib/actions/auth'
import { MensajeForm } from '@/components/mensaje-form'

export function RecuperarForm() {
  const { estado, pendiente, formProps } = useFormAction(solicitarRecuperacion)

  if (estado?.mensaje)
    return (
      <form {...formProps} className="space-y-5">
        <MensajeForm mensaje={estado.mensaje} />
        <p className="text-sm text-ink-soft">
          Revise su bandeja de entrada y el correo no deseado. Abra el enlace del mensaje para elegir una clave nueva.
        </p>
        <Link href="/login" className="btn-secundario w-full">
          Volver a iniciar sesión
        </Link>
      </form>
    )

  return (
    <form {...formProps} className="space-y-4">
      <div>
        <label className="etiqueta-campo" htmlFor="email">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="email"
          className="campo"
          placeholder="usted@correo.com"
        />
      </div>
      <MensajeForm error={estado?.error} mensaje={estado?.mensaje} />
      <button disabled={pendiente} className="btn-primario w-full">
        {pendiente ? 'Enviando enlace…' : 'Enviar enlace de recuperación'}
      </button>
      <p className="text-center text-sm text-ink-soft">
        <Link href="/login" className="enlace-texto font-semibold">
          Volver a iniciar sesión
        </Link>
      </p>
    </form>
  )
}
