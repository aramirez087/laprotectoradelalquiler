'use client'

import { useFormAction } from '@/components/use-form-action'
import { cambiarClave, type EstadoForm } from '@/lib/actions/auth'
import { CampoClave } from '@/components/campo-clave'
import { MensajeForm } from '@/components/mensaje-form'
import Link from '@/components/enlace'

type AccionClave = (estado: EstadoForm, datos: FormData) => Promise<EstadoForm>

export function FormClave({
  accion = cambiarClave,
  etiqueta = 'Cambiar clave',
  anchoCompleto = false,
  siguiente = '/',
  correo,
  enlaceRecuperacion,
}: {
  accion?: AccionClave
  etiqueta?: string
  anchoCompleto?: boolean
  siguiente?: string
  correo?: string
  enlaceRecuperacion?: string
}) {
  const { estado, pendiente, formProps } = useFormAction(accion, { resetOnSuccess: true })

  return (
    <form {...formProps} className="max-w-md space-y-4">
      <input type="hidden" name="siguiente" value={siguiente} />
      {correo && <input type="email" name="email" value={correo} readOnly hidden autoComplete="username" />}
      {estado?.mensaje && estado.destino && !estado.error ? (
        <>
          <MensajeForm mensaje={estado.mensaje} />
          <Link href={estado.destino} className="btn-primario flex w-full">Continuar con mi cuenta</Link>
        </>
      ) : (
        <>
          <div>
            <label className="etiqueta-campo" htmlFor="clave">
              Clave nueva
            </label>
            <CampoClave id="clave" name="clave" autoComplete="new-password" describedBy="ayuda-clave" readOnly={pendiente} />
            <p id="ayuda-clave" className="mt-1 text-xs text-ink-soft">
              Al menos 8 caracteres, con letras y números.
            </p>
          </div>
          <div>
            <label className="etiqueta-campo" htmlFor="confirmacion">
              Confirme la clave nueva
            </label>
            <CampoClave id="confirmacion" name="confirmacion" autoComplete="new-password" readOnly={pendiente} />
          </div>
          <MensajeForm error={pendiente ? undefined : estado?.error} mensaje={pendiente ? undefined : estado?.mensaje} />
          {estado?.error && !pendiente && enlaceRecuperacion && (
            <Link href={enlaceRecuperacion} className="enlace-texto font-semibold">Solicitar otro enlace de recuperación</Link>
          )}
          <button type="submit" disabled={pendiente} className={`btn-primario ${anchoCompleto ? 'w-full' : 'w-full sm:w-auto'}`}>
            {pendiente ? 'Guardando…' : etiqueta}
          </button>
        </>
      )}
    </form>
  )
}
