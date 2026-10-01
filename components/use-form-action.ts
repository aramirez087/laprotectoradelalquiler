'use client'

import { startTransition, useActionState, useEffect, useRef, type FormEvent, type RefObject } from 'react'
import { unstable_rethrow } from 'next/navigation'
import type { EstadoForm } from '@/lib/actions/auth'
import { registrarErrorCliente } from '@/lib/error-cliente'

type Accion = (estado: EstadoForm, datos: FormData) => Promise<EstadoForm>

/** Keep entered values on recoverable errors; React otherwise resets uncontrolled fields. */
export function useFormAction(accion: Accion, { resetOnSuccess = false, onResultado, formulario }: {
  resetOnSuccess?: boolean
  onResultado?: (resultado: EstadoForm) => void
  formulario?: RefObject<HTMLFormElement | null>
} = {}) {
  const accionConAviso: Accion = async (prev, datos) => {
    try {
      const resultado = await accion(prev, datos)
      onResultado?.(resultado)
      return resultado
    } catch (error) {
      unstable_rethrow(error)
      registrarErrorCliente(error, 'accion')
      return { error: 'No pudimos confirmar la operación. Sus datos se conservan. Revise el resultado antes de volver a enviar.' }
    }
  }
  const [estado, action, pendiente] = useActionState(accionConAviso, undefined)
  const interno = useRef<HTMLFormElement>(null)
  const formRef = formulario ?? interno

  useEffect(() => {
    if (!estado?.error && !estado?.mensaje) return
    const form = formRef.current
    if (resetOnSuccess && estado.mensaje && !estado.error) form?.reset()
    const destino =
      form?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      form?.querySelector<HTMLElement>('[role="alert"], [role="status"]')
    const detalles = destino?.closest('details')
    if (detalles) detalles.open = true
    destino?.focus()
  }, [estado, resetOnSuccess, formRef])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pendiente) return
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const datos = new FormData(event.currentTarget, submitter)
    startTransition(() => action(datos))
  }

  return { estado, pendiente, formProps: { ref: formRef, action, onSubmit, 'aria-busy': pendiente } }
}
