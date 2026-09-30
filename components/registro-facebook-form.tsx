'use client'

import { useFormAction } from '@/components/use-form-action'
import { completarAltaFacebook, cerrarSesion } from '@/lib/actions/auth'
import { MensajeForm } from '@/components/mensaje-form'

const ROLES = [
  { value: 'propietario', titulo: 'Propietario', descripcion: 'Alquilo una propiedad propia.', defecto: true },
  { value: 'agencia', titulo: 'Agencia', descripcion: 'Gestiono alquileres para otras personas.', defecto: false },
]

export function RegistroFacebookForm({
  nombre,
  email,
  cedula,
  facebook,
  pedirRol,
}: {
  nombre: string
  email: string
  cedula: string
  facebook: string
  pedirRol: boolean
}) {
  const { estado, pendiente, formProps } = useFormAction(completarAltaFacebook)

  return (
    <div className="space-y-4">
      <form {...formProps} className="space-y-4">
        <p className="text-xs text-ink-soft">Todos los campos son obligatorios.</p>
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
            defaultValue={nombre}
            autoComplete="name"
          />
        </div>
        <dl className="rounded-xl border border-line bg-paper p-3">
          <dt className="text-xs text-ink-soft">Correo confirmado por Facebook</dt>
          <dd className="mt-1 break-all text-sm font-medium">{email}</dd>
        </dl>
        <div>
          <label className="etiqueta-campo" htmlFor="cedula">
            Número de cédula
          </label>
          <input
            id="cedula"
            name="cedula"
            required
            className="campo"
            defaultValue={cedula}
            placeholder="1-0234-0567"
            autoComplete="off"
            inputMode="numeric"
            spellCheck={false}
            maxLength={30}
            aria-describedby="ayuda-cedula"
          />
          <p id="ayuda-cedula" className="mt-1 text-xs text-ink-soft">
            Identifica su cuenta. La cédula completa no se muestra al público.
          </p>
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
            defaultValue={facebook}
            placeholder="Su nombre en Facebook, usuario o enlace"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={300}
            aria-describedby="ayuda-facebook"
          />
          <p id="ayuda-facebook" className="mt-1 text-xs text-ink-soft">
            Puede escribir su nombre en Facebook, su usuario o pegar el enlace de su perfil. Administración lo usa para revisar su experiencia.
          </p>
        </div>
        {pedirRol && (
          <fieldset>
            <legend className="etiqueta-campo">Tipo de cuenta</legend>
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
        )}
        <MensajeForm error={estado?.error} mensaje={estado?.mensaje} />
        <button disabled={pendiente} className="btn-primario w-full">
          {pendiente ? 'Guardando…' : 'Continuar a la reseña'}
        </button>
      </form>
      <form action={cerrarSesion}>
        <button type="submit" disabled={pendiente} className="btn-secundario w-full">
          Cerrar sesión y salir
        </button>
      </form>
    </div>
  )
}
