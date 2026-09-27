'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { solicitarRecuperacion } from '@/lib/actions/auth'
import { MensajeForm } from '@/components/mensaje-form'

export function RecuperarForm() {
  const [estado, action, pendiente] = useActionState(solicitarRecuperacion, undefined)

  return (
    <form action={action} className="space-y-4">
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
