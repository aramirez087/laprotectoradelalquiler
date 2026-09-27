'use client'

import { useActionState } from 'react'
import { cambiarClave } from '@/lib/actions/auth'
import { CampoClave } from '@/components/campo-clave'
import { MensajeForm } from '@/components/mensaje-form'

export function FormClave() {
  const [estado, action, pendiente] = useActionState(cambiarClave, undefined)

  return (
    <form action={action} className="max-w-md space-y-4">
      <div>
        <label className="etiqueta-campo" htmlFor="clave">
          Clave nueva
        </label>
        <CampoClave id="clave" name="clave" autoComplete="new-password" describedBy="ayuda-clave" />
        <p id="ayuda-clave" className="mt-1 text-xs text-ink-soft">
          Al menos 8 caracteres, con letras y números.
        </p>
      </div>
      <div>
        <label className="etiqueta-campo" htmlFor="confirmacion">
          Repita la clave
        </label>
        <CampoClave id="confirmacion" name="confirmacion" autoComplete="new-password" />
      </div>
      <MensajeForm error={estado?.error} mensaje={estado?.mensaje} />
      <button disabled={pendiente} className="btn-primario">
        {pendiente ? 'Guardando…' : 'Cambiar clave'}
      </button>
    </form>
  )
}
