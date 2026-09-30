'use client'

import { useEffect, useRef, useState } from 'react'
import Link from '@/components/enlace'
import { useFormAction } from '@/components/use-form-action'
import { solicitarRecuperacion } from '@/lib/actions/auth'
import { MensajeForm } from '@/components/mensaje-form'

export function RecuperarForm() {
  const [correo, setCorreo] = useState('')
  const [correoSolicitado, setCorreoSolicitado] = useState('')
  const [reintentoDesde, setReintentoDesde] = useState(0)
  const correoInput = useRef<HTMLInputElement>(null)
  const { estado, pendiente, formProps } = useFormAction(async (anterior, datos) => {
    const normalizado = String(datos.get('email') ?? '').trim().toLowerCase()
    datos.set('email', normalizado)
    setCorreo(normalizado)
    setCorreoSolicitado(normalizado)
    setReintentoDesde(0)
    const respuesta = await solicitarRecuperacion(anterior, datos)
    if (respuesta?.mensaje && !respuesta.error) setReintentoDesde(Date.now() + 60_000)
    return respuesta
  })
  const mismaDireccion = correo.trim().toLowerCase() === correoSolicitado
  const resultado = mismaDireccion && !pendiente ? estado : undefined
  const solicitudRecibida = !pendiente && mismaDireccion && Boolean(estado?.mensaje) && !estado?.error
  const esperandoReintento = mismaDireccion && reintentoDesde > 0

  useEffect(() => {
    if (!reintentoDesde) return
    const temporizador = setTimeout(() => setReintentoDesde(0), Math.max(0, reintentoDesde - Date.now()))
    return () => clearTimeout(temporizador)
  }, [reintentoDesde])

  function corregirCorreo() {
    correoInput.current?.focus()
    correoInput.current?.select()
  }

  return (
    <form {...formProps} onSubmit={(event) => {
      if (esperandoReintento) {
        event.preventDefault()
        return
      }
      formProps.onSubmit(event)
    }} className="space-y-4">
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
      {solicitudRecibida ? (
        <>
          <section className="space-y-3" aria-labelledby="recuperacion-pasos-titulo">
            <h2 id="recuperacion-pasos-titulo" className="text-base font-medium">Revise su correo</h2>
            {correoSolicitado && <p className="text-sm leading-6 text-ink-soft">Correo de la solicitud: <strong className="break-all font-medium text-ink">{correoSolicitado}</strong>.</p>}
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-ink-soft">
              <li>Espere unos minutos y revise su bandeja de entrada y el correo no deseado.</li>
              <li>Si recibe el mensaje, abra el enlace en este mismo navegador.</li>
              <li>Elija una clave nueva para continuar con su cuenta.</li>
            </ol>
          </section>
          <details className="border-y border-line">
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">No recibí el mensaje</summary>
            <div className="space-y-3 pb-4">
              <p className="text-sm leading-6 text-ink-soft">Compruebe que escribió bien su correo. Si necesita otro enlace, espere al menos un minuto antes de pedirlo.</p>
              <button type="button" disabled={pendiente} onClick={corregirCorreo} className="btn-secundario w-full">Corregir correo</button>
              <button disabled={pendiente || esperandoReintento} aria-describedby={esperandoReintento ? 'recuperacion-espera' : undefined} className="btn-primario w-full">
                {pendiente ? 'Solicitando enlace…' : 'Solicitar otro enlace'}
              </button>
              {esperandoReintento && <p id="recuperacion-espera" className="text-xs leading-6 text-ink-soft">Podrá solicitar otro enlace al pasar un minuto desde la última solicitud.</p>}
            </div>
          </details>
        </>
      ) : (
        <button disabled={pendiente || esperandoReintento} className="btn-primario w-full">
          {pendiente ? 'Solicitando enlace…' : resultado?.error ? 'Volver a intentar' : 'Solicitar enlace de recuperación'}
        </button>
      )}
      <details className="border-b border-line">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">¿Usaba la versión anterior?</summary>
        <p className="pb-4 text-sm leading-6 text-ink-soft">Use el mismo correo que utilizaba antes. Si su clave anterior no funciona, solicite aquí un enlace para elegir una nueva.</p>
      </details>
      <details className="border-b border-line">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">El enlace no funciona</summary>
        <p className="pb-4 text-sm leading-6 text-ink-soft">Si el enlace venció o ya se usó, solicite uno nuevo desde este formulario. Si recibe varios mensajes, abra solo el enlace más reciente, en el mismo navegador donde lo solicitó.</p>
      </details>
      <p className="text-center text-sm text-ink-soft">
        <Link href="/login" className="enlace-texto font-semibold">
          Volver a iniciar sesión
        </Link>
      </p>
    </form>
  )
}
