'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { iniciarSesion } from '@/lib/actions/auth'
import { CampoClave } from '@/components/campo-clave'
import { MensajeForm } from '@/components/mensaje-form'

export function LoginForm({ siguiente }: { siguiente: string }) {
  const [estado, action, pendiente] = useActionState(iniciarSesion, undefined)

  return (
    <form action={action} className="space-y-4">
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
          autoComplete="email"
          autoCapitalize="none"
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
      <MensajeForm error={estado?.error} />
      <button disabled={pendiente} className="btn-primario w-full">
        {pendiente ? 'Entrando…' : 'Iniciar sesión'}
      </button>
      <p className="text-center text-sm text-ink-soft">
        ¿No tiene cuenta?{' '}
        <Link href="/registro" className="font-semibold text-seal underline-offset-2 hover:underline">
          Registrarse
        </Link>
      </p>
    </form>
  )
}
