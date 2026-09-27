'use client'

import { useActionState } from 'react'
import { cambiarClave, type EstadoForm } from '@/lib/actions/auth'
import { CampoClave } from '@/components/campo-clave'
import { MensajeForm } from '@/components/mensaje-form'

type AccionClave = (estado: EstadoForm, datos: FormData) => Promise<EstadoForm>

export function FormClave({
  accion = cambiarClave,
  etiqueta = 'Cambiar clave',
}: {
  accion?: AccionClave
  etiqueta?: string
}) {
  const [estado, action, pendiente] = useActionState(accion, undefined)

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
        {pendiente ? 'Guardando…' : etiqueta}
      </button>
    </form>
  )
}
