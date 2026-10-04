'use client'

import Link from '@/components/enlace'
import { useState } from 'react'
import { useFormAction } from '@/components/use-form-action'
import { registrarse } from '@/lib/actions/auth'
import { CamposIdentidad } from '@/components/campos-identidad'
import { CampoClave } from '@/components/campo-clave'
import { MensajeForm } from '@/components/mensaje-form'
import { ConfirmarCorreoForm } from '@/components/confirmar-correo-form'

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
]

export function RegistroForm({
  siguiente = '/',
  correo = '',
  enlaceFacebook = null,
}: {
  siguiente?: string
  correo?: string
  enlaceFacebook?: string | null
}) {
  const { estado, pendiente, formProps } = useFormAction(registrarse)
  const [email, setEmail] = useState(correo)
  const mismaDireccion = !estado?.email || email.trim().toLowerCase() === estado.email
  const parametros = new URLSearchParams({ siguiente })
  if (email.trim()) parametros.set('correo', email.trim())

  if (estado?.mensaje && !estado.error) {
    return (
      <div className="space-y-5">
        <form {...formProps} className="space-y-4">
          <MensajeForm mensaje={estado.mensaje} />
          <p className="text-sm leading-6 text-ink-soft">
            Revise la bandeja de entrada y el correo no deseado de <strong className="break-all font-medium text-ink">{estado.email || email}</strong>. Abra el enlace de confirmación para continuar con su primera reseña.
          </p>
          <Link href={`/login?${parametros}`} className="btn-secundario flex w-full">
            Ya confirmé mi correo: iniciar sesión
          </Link>
        </form>
        <details className="border-y border-line">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">No recibí el mensaje</summary>
          <div className="pb-4">
            <ConfirmarCorreoForm correo={estado.email || email} siguiente={siguiente} />
          </div>
        </details>
      </div>
    )
  }

  return (
    <form {...formProps} className="space-y-4">
      <div className="border-b border-line pb-4 text-sm leading-relaxed text-ink-soft">
        <p>¿Ya tiene cuenta, incluso de la versión anterior?</p>
        <div className="flex flex-wrap gap-x-4">
          <Link href={`/login?${parametros}`} className="enlace-texto font-semibold">Iniciar sesión</Link>
          <Link href={`/recuperar?${parametros}`} className="enlace-texto font-semibold">Recuperar mi clave</Link>
        </div>
        <p className="text-xs">Use el mismo correo. No necesita crear otra cuenta.</p>
      </div>
      {enlaceFacebook && (
        <div className="space-y-5 pb-1">
          <a className="btn-secundario flex w-full" href={enlaceFacebook}>
            Continuar con Facebook
          </a>
          <div className="flex items-center gap-3 text-xs text-ink-soft">
            <span aria-hidden="true" className="h-px flex-1 bg-line" />
            <span>o cree su cuenta con correo</span>
            <span aria-hidden="true" className="h-px flex-1 bg-line" />
          </div>
        </div>
      )}
      <input type="hidden" name="siguiente" value={siguiente} />
      <fieldset disabled={pendiente} className="space-y-4">
        <legend className="sr-only">Datos de su nueva cuenta</legend>
        <p className="text-xs text-ink-soft">Todos los campos son obligatorios.</p>
        <CamposIdentidad tipo="cuenta" campoCedula="cedula" />
        <div>
          <label className="etiqueta-campo" htmlFor="email">
            Correo electrónico
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="campo"
            placeholder="usted@correo.com"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
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
            placeholder="Su nombre en Facebook, usuario o enlace"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby="ayuda-facebook"
          />
          <p id="ayuda-facebook" className="mt-1 text-xs text-ink-soft">
            Puede escribir su nombre en Facebook, su usuario o pegar el enlace de su perfil. Administración lo usa para revisar su experiencia.
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
      </fieldset>
      <MensajeForm error={pendiente || !mismaDireccion ? undefined : estado?.error} />
      {estado?.recuperable && !pendiente && mismaDireccion && (
        <Link href={`/recuperar?${parametros}`} className="inline-flex min-h-11 items-center font-semibold text-seal underline underline-offset-4">
          Recuperar el acceso a mi cuenta
        </Link>
      )}
      <button type="submit" disabled={pendiente} className="btn-primario w-full">
        {pendiente ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>
      <p className="text-center text-xs leading-relaxed text-ink-soft">Recibirá un correo para confirmar su cuenta antes de entrar.</p>
      <p className="text-center text-xs leading-relaxed text-ink-soft">
        Su primera reseña le da <strong className="font-semibold">3 meses para consultar</strong>, desde que administración la aprueba.
      </p>
      <p className="text-center text-xs leading-relaxed text-ink-soft">
        Conozca cómo cuidamos sus datos en la{' '}
        <Link href="/privacidad" className="text-seal underline underline-offset-4">política de privacidad</Link>.
      </p>
      <p className="border-t border-line pt-4 text-center text-sm text-ink-soft">
        ¿Ya tiene cuenta?{' '}
        <Link
          href={`/login?${parametros}`}
          className="inline-flex min-h-11 items-center font-semibold text-seal underline underline-offset-4"
        >
          Iniciar sesión
        </Link>
      </p>
    </form>
  )
}
