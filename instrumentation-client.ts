import { registrarErrorCliente } from '@/lib/error-cliente'
import type { ContextoErrorCliente } from '@/lib/diagnostico-error-cliente'

function informar(error: unknown, contexto: ContextoErrorCliente) {
  const diagnostico = registrarErrorCliente(error, 'navegador', contexto)
  if (diagnostico?.categoria === 'browser-wallet') return
  window.dispatchEvent(new Event('protectora:error-cliente'))
}

window.addEventListener('error', event => {
  if (event.error) informar(event.error, {
    evento: 'error', archivo: event.filename, linea: event.lineno, columna: event.colno,
  })
})
window.addEventListener('unhandledrejection', event => informar(event.reason, { evento: 'unhandledrejection' }))
