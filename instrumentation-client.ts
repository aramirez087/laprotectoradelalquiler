import { registrarErrorCliente } from '@/lib/error-cliente'

function informar(error: unknown) {
  registrarErrorCliente(error, 'navegador')
  window.dispatchEvent(new Event('protectora:error-cliente'))
}

window.addEventListener('error', event => { if (event.error) informar(event.error) })
window.addEventListener('unhandledrejection', event => informar(event.reason))
