'use client'

import { useFormAction } from '@/components/use-form-action'
import { procesarAvisosAction } from '@/lib/actions/activacion'
import { MensajeForm } from '@/components/mensaje-form'

export function ReintentarAvisos() {
  const { estado, pendiente, formProps } = useFormAction(procesarAvisosAction)
  return <form {...formProps} className="mt-4 space-y-3">
    <button className="btn-secundario" disabled={pendiente}>{pendiente ? 'Procesando avisos…' : 'Procesar avisos pendientes'}</button>
    <MensajeForm mensaje={estado?.mensaje} error={estado?.error} />
  </form>
}
