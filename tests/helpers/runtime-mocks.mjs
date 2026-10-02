import { createElement } from 'react'
import { esOrigenPropio } from '../../lib/origen.ts'
import { rutaDiagnostico } from '../../lib/ruta-diagnostico.ts'
import * as busqueda from '../../lib/busqueda-fichas.ts'
import * as diagnosticoErrorCliente from '../../lib/diagnostico-error-cliente.ts'
import * as dosFactores from '../../lib/dos-factores.ts'

// VM suites isolate framework/client boundaries; browser checks exercise their runtime.
export const runtimeMocks = {
  '@/lib/dos-factores': dosFactores,
  '@/components/seguridad-dos-factores': { SeguridadDosFactores: () => null },
  '@/lib/diagnostico-error-cliente': diagnosticoErrorCliente,
  '@/lib/busqueda-fichas': busqueda,
  '@/lib/resultado-busqueda-confirmado': { confirmarResultadoBusqueda: () => null, confirmarAperturaFicha: () => null, contextoBusquedaConfirmado: () => null },
  '@/components/resultado-busqueda': { ResultadoBusqueda: () => null },
  '@/lib/borrador-resena-servidor': { obtenerBorradorResena: async () => ({ disponible: false, datos: null, version: null }) },
  '@/lib/avisos-moderacion': { procesarAvisosSinInterrumpir: async () => {} },
  '@/lib/moderacion-automatica': { intentarAprobacionAutomatica: async () => false },
  '@/lib/origen': { esOrigenPropio },
  '@/lib/ruta-diagnostico': { rutaDiagnostico },
  '@/components/enlace': ({ children, href, ...props }) => createElement('a', { ...props, href }, children),
  '@/components/formulario-busqueda': { FormularioBusqueda: ({ children, ...props }) => createElement('form', { ...props, method: 'GET' }, children) },
  '@/components/boton-salir': { BotonSalir: ({ children, ...props }) => createElement('button', { ...props, type: 'submit' }, children) },
  '@/components/indicador-carga': { IndicadorCarga: ({ texto }) => createElement('span', { role: 'status' }, texto) },
  '@/lib/registro-error': { registrarError: () => 'test-reference' },
  '@/lib/error-cliente': { registrarErrorCliente: () => {} },
}
