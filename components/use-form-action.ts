'use client'

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from 'react'
import type { EstadoForm } from '@/lib/actions/auth'

type Accion = (estado: EstadoForm, datos: FormData) => Promise<EstadoForm>

/** Keep entered values on recoverable errors; React otherwise resets uncontrolled fields. */
export function useFormAction(accion: Accion, { resetOnSuccess = false } = {}) {
  const [estado, action, pendiente] = useActionState(accion, undefined)
  const formRef = useRef<HTMLFormElement>(null)

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
  }, [estado, resetOnSuccess])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pendiente) return
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const datos = new FormData(event.currentTarget, submitter)
    startTransition(() => action(datos))
  }

  return { estado, pendiente, formProps: { ref: formRef, action, onSubmit, 'aria-busy': pendiente } }
}
