'use client'

import Link from 'next/link'
import { useFormAction } from '@/components/use-form-action'
import { registrarse } from '@/lib/actions/auth'
import { CampoClave } from '@/components/campo-clave'
import { MensajeForm } from '@/components/mensaje-form'

const ROLES = [
  {
    value: 'propietario',
    titulo: 'Propietario',
    descripcion: 'Alquilo una propiedad propia.',
    defecto: true,
  },
  {
    value: 'agencia',
    titulo: 'Agencia',
    descripcion: 'Gestiono alquileres para otras personas.',
    defecto: false,
  },
  { value: 'inquilino', titulo: 'Inquilino', descripcion: 'Alquilo una vivienda o local.', defecto: false },
]

export function RegistroForm({
  siguiente = '/fichas',
  enlaceFacebook = null,
}: {
  siguiente?: string
  enlaceFacebook?: string | null
}) {
  const { estado, pendiente, formProps } = useFormAction(registrarse)

  return (
    <form {...formProps} className="space-y-4">
      {enlaceFacebook && (
        <a className="btn-secundario flex w-full" href={enlaceFacebook}>
          Continuar con Facebook
        </a>
      )}
      <div>
        <label className="etiqueta-campo" htmlFor="nombre">
          Nombre completo
        </label>
        <input
          id="nombre"
          name="nombre"
          required
          minLength={3}
          className="campo"
          placeholder="María Solís Rodríguez"
          autoComplete="name"
        />
      </div>
      <div>
        <label className="etiqueta-campo" htmlFor="cedula">
          Número de cédula
        </label>
        <input
          id="cedula"
          name="cedula"
          required
          className="campo"
          placeholder="1-0234-0567"
          autoComplete="off"
          spellCheck={false}
          maxLength={30}
          aria-describedby="ayuda-cedula"
        />
        <p id="ayuda-cedula" className="mt-1 text-xs text-ink-soft">
          Identifica su cuenta. La cédula completa no se muestra al público.
        </p>
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
        <label className="etiqueta-campo" htmlFor="facebook">
          Perfil de Facebook
        </label>
        <input
          id="facebook"
          name="facebook"
          required
          className="campo"
          placeholder="facebook.com/su.perfil"
          autoComplete="off"
          spellCheck={false}
          maxLength={300}
          aria-describedby="ayuda-facebook"
        />
        <p id="ayuda-facebook" className="mt-1 text-xs text-ink-soft">
          El enlace de su perfil, o solo el usuario.
        </p>
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
            <label key={rol.value} className="opcion-rol flex items-start gap-3">
              <input
                type="radio"
                name="rol"
                value={rol.value}
                defaultChecked={rol.defecto}
                className="mt-1 h-4 w-4 shrink-0 accent-[var(--seal)]"
              />
              <span>
                <span className="block text-sm font-medium">{rol.titulo}</span>
                <span className="mt-0.5 block text-xs text-ink-soft">{rol.descripcion}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <MensajeForm error={estado?.error} mensaje={estado?.mensaje} />
      <button disabled={pendiente} className="btn-primario w-full">
        {pendiente ? 'Creando cuenta…' : 'Continuar a la reseña'}
      </button>
      <p className="text-center text-sm text-ink-soft">
        ¿Ya tiene cuenta?{' '}
        <Link
          href={`/login?${new URLSearchParams({ siguiente })}`}
          className="font-semibold text-seal underline-offset-2 hover:underline"
        >
          Iniciar sesión
        </Link>
      </p>
    </form>
  )
}
