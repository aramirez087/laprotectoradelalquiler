import { createElement } from 'react'
import { esOrigenPropio } from '../../lib/origen.ts'

// VM suites isolate framework/client boundaries; browser checks exercise their runtime.
export const runtimeMocks = {
  '@/lib/origen': { esOrigenPropio },
  '@/components/enlace': ({ children, href, ...props }) => createElement('a', { ...props, href }, children),
  '@/components/formulario-busqueda': { FormularioBusqueda: ({ children, ...props }) => createElement('form', { ...props, method: 'GET' }, children) },
  '@/components/boton-salir': { BotonSalir: ({ children, ...props }) => createElement('button', { ...props, type: 'submit' }, children) },
  '@/components/indicador-carga': { IndicadorCarga: ({ texto }) => createElement('span', { role: 'status' }, texto) },
  '@/lib/registro-error': { registrarError: () => 'test-reference' },
  '@/lib/error-cliente': { registrarErrorCliente: () => {} },
}
