'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { registrarse } from '@/lib/actions/auth'
import { CampoClave } from '@/components/campo-clave'
import { MensajeForm } from '@/components/mensaje-form'

const ROLES = [
  { value: 'propietario', titulo: 'Propietario', defecto: true },
  { value: 'agencia', titulo: 'Agencia', defecto: false },
  { value: 'inquilino', titulo: 'Inquilino', defecto: false },
]

export function RegistroForm() {
  const [estado, action, pendiente] = useActionState(registrarse, undefined)

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="etiqueta-campo" htmlFor="nombre">
          Nombre completo
        </label>
        <input id="nombre" name="nombre" required className="campo" placeholder="María Solís Rodríguez" autoComplete="name" />
      </div>
      <div>
        <label className="etiqueta-campo" htmlFor="email">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="campo"
          placeholder="usted@correo.com"
          autoComplete="email"
          autoCapitalize="none"
        />
      </div>
      <div>
        <label className="etiqueta-campo" htmlFor="clave">
          Clave
        </label>
        <CampoClave id="clave" name="clave" autoComplete="new-password" describedBy="ayuda-clave" />
        <p id="ayuda-clave" className="mt-1 text-xs text-ink-soft">
          Mínimo 8 caracteres, con letras y números.
        </p>
      </div>
      <fieldset>
        <legend className="etiqueta-campo">Soy…</legend>
        <div className="grid gap-2">
          {ROLES.map((rol) => (
            <label key={rol.value} className="opcion-rol">
              <input type="radio" name="rol" value={rol.value} defaultChecked={rol.defecto} className="sr-only" />
              <span className="block text-sm font-medium">{rol.titulo}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <MensajeForm error={estado?.error} mensaje={estado?.mensaje} />
      <button disabled={pendiente} className="btn-primario w-full">
        {pendiente ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>
      <p className="text-center text-sm text-ink-soft">
        ¿Ya tiene cuenta?{' '}
        <Link href="/login" className="font-semibold text-seal underline-offset-2 hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </form>
  )
}
