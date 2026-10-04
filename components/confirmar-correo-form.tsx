'use client'

import { useEffect, useRef, useState } from 'react'
import { useFormAction } from '@/components/use-form-action'
import { confirmarCorreoPendiente } from '@/lib/actions/auth'
import { MensajeForm } from '@/components/mensaje-form'

export function ConfirmarCorreoForm({ correo = '', siguiente = '/', enfocar = false, volverAlLogin = false }: { correo?: string; siguiente?: string; enfocar?: boolean; volverAlLogin?: boolean }) {
  const titulo = useRef<HTMLHeadingElement>(null)
  const [email, setEmail] = useState(correo)
  const [correoSolicitado, setCorreoSolicitado] = useState(correo)
  const [reintentoDesde, setReintentoDesde] = useState(0)
  const { estado, pendiente, formProps } = useFormAction(async (anterior, datos) => {
    const normalizado = String(datos.get('email') ?? '').trim().toLowerCase()
    datos.set('email', normalizado)
    setEmail(normalizado)
    setCorreoSolicitado(normalizado)
    const resultado = await confirmarCorreoPendiente(anterior, datos)
    if (resultado?.mensaje && !resultado.error) setReintentoDesde(Date.now() + 60_000)
    return resultado
  })
  const mismaDireccion = email.trim().toLowerCase() === correoSolicitado
  const esperandoReintento = mismaDireccion && reintentoDesde > 0

  useEffect(() => {
    if (enfocar) titulo.current?.focus()
  }, [enfocar])

  useEffect(() => {
    if (!reintentoDesde) return
    const temporizador = setTimeout(() => setReintentoDesde(0), Math.max(0, reintentoDesde - Date.now()))
    return () => clearTimeout(temporizador)
  }, [reintentoDesde])

  return (
    <section className="space-y-3 rounded-xl border border-line p-4" aria-labelledby="confirmar-correo-titulo">
      <h2 ref={titulo} tabIndex={-1} id="confirmar-correo-titulo" className="scroll-mt-24 text-base font-semibold">Confirmar su correo</h2>
      <p className="text-sm leading-6 text-ink-soft">Solicite un enlace nuevo al correo con el que creó su cuenta.</p>
      <form {...formProps} onSubmit={(event) => {
        if (esperandoReintento) {
          event.preventDefault()
          return
        }
        formProps.onSubmit(event)
      }} className="space-y-3">
        <input type="hidden" name="siguiente" value={siguiente} />
        <div>
          <label htmlFor="confirmar-correo-email" className="etiqueta-campo">Correo de su cuenta</label>
          <input id="confirmar-correo-email" name="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} readOnly={pendiente} autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="email" className="campo" />
        </div>
        <MensajeForm error={mismaDireccion && !pendiente ? estado?.error : undefined} mensaje={mismaDireccion && !pendiente ? estado?.mensaje : undefined} />
        <button type="submit" disabled={pendiente || esperandoReintento} aria-describedby={esperandoReintento ? 'confirmar-correo-espera' : undefined} className="btn-primario w-full">
          {pendiente ? 'Solicitando confirmación…' : 'Enviar otro correo de confirmación'}
        </button>
        {esperandoReintento && <p id="confirmar-correo-espera" className="text-xs leading-6 text-ink-soft">Espere un minuto desde la última solicitud antes de pedir otro enlace.</p>}
      </form>
      {volverAlLogin && (
        <p className="border-t border-line pt-4 text-center text-sm text-ink-soft">
          <a href={`/login?${new URLSearchParams({ siguiente, correo: email.trim() })}`} className="inline-flex min-h-11 items-center font-semibold text-seal underline underline-offset-4">
            Volver a iniciar sesión
          </a>
        </p>
      )}
    </section>
  )
}
