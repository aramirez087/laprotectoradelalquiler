'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useFormAction } from '@/components/use-form-action'
import { solicitarRecuperacion } from '@/lib/actions/auth'
import { MensajeForm } from '@/components/mensaje-form'

export function RecuperarForm() {
  const [correo, setCorreo] = useState('')
  const [correoSolicitado, setCorreoSolicitado] = useState('')
  const correoInput = useRef<HTMLInputElement>(null)
  const { estado, pendiente, formProps } = useFormAction(async (anterior, datos) => {
    const normalizado = String(datos.get('email') ?? '').trim().toLowerCase()
    datos.set('email', normalizado)
    setCorreo(normalizado)
    setCorreoSolicitado(normalizado)
    return solicitarRecuperacion(anterior, datos)
  })
  const mismaDireccion = correo.trim().toLowerCase() === correoSolicitado
  const resultado = mismaDireccion && !pendiente ? estado : undefined
  const solicitudRecibida = Boolean(resultado?.mensaje)

  function corregirCorreo() {
    correoInput.current?.focus()
    correoInput.current?.select()
  }

  return (
    <form {...formProps} className="space-y-4">
      <div>
        <label className="etiqueta-campo" htmlFor="recuperacion-email">
          Correo electrónico de su cuenta
        </label>
        <input
          ref={correoInput}
          id="recuperacion-email"
          name="email"
          type="email"
          required
          value={correo}
          onChange={(event) => setCorreo(event.target.value)}
          disabled={pendiente}
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="email"
          aria-describedby="recuperacion-email-ayuda"
          className="campo"
          placeholder="usted@correo.com"
        />
        <p id="recuperacion-email-ayuda" className="mt-2 text-xs leading-6 text-ink-soft">
          Compruebe que sea el correo que utilizó para crear su cuenta.
        </p>
      </div>
      <MensajeForm error={resultado?.error} mensaje={resultado?.mensaje} />
      {solicitudRecibida && correoSolicitado && <p className="break-words text-sm text-ink-soft">Correo de la solicitud: <strong className="break-all font-medium text-ink">{correoSolicitado}</strong>.</p>}
      <button disabled={pendiente} className="btn-primario w-full">
        {pendiente ? 'Solicitando enlace…' : solicitudRecibida ? 'Solicitar otro enlace' : 'Solicitar enlace de recuperación'}
      </button>
      {solicitudRecibida && (
        <>
          <button type="button" onClick={corregirCorreo} className="btn-secundario w-full">Corregir correo</button>
          <section className="space-y-3 border-t border-line pt-4" aria-labelledby="recuperacion-ayuda-titulo">
            <h2 id="recuperacion-ayuda-titulo" className="text-base font-medium">Si no encuentra el mensaje</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-ink-soft">
              <li>Espere unos minutos y revise el correo no deseado y las otras carpetas de su bandeja.</li>
              <li>Busque un mensaje de recuperación de clave y compruebe que escribió bien su correo.</li>
              <li>Si recibe varios mensajes, abra el enlace del más reciente para elegir una clave nueva.</li>
            </ul>
            <p className="text-sm leading-6 text-ink-soft">Puede corregir el correo o volver a solicitar el enlace desde este formulario.</p>
          </section>
        </>
      )}
      <p className="text-center text-sm text-ink-soft">
        <Link href="/login" className="enlace-texto font-semibold">
          Volver a iniciar sesión
        </Link>
      </p>
    </form>
  )
}
