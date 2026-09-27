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
          Revise también el correo no deseado. Puede cerrar esta página cuando reciba el enlace.
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
          className="campo"
          placeholder="usted@correo.com"
        />
      </div>
      <MensajeForm error={estado?.error} mensaje={estado?.mensaje} />
      <button disabled={pendiente} className="btn-primario w-full">
        {pendiente ? 'Enviando…' : 'Enviar enlace'}
      </button>
      <p className="text-center text-sm text-ink-soft">
        <Link href="/login" className="font-semibold text-seal underline-offset-2 hover:underline">
          Volver a entrar
        </Link>
      </p>
    </form>
  )
}
