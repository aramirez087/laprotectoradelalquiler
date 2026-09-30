import { runtimeMocks } from './runtime-mocks.mjs'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const ts = require('typescript')
export function cargarTS(archivo, mocks = {}, globals = {}) {
  const mod = { exports: {} }
  const codigo = ts.transpileModule(readFileSync(archivo, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  vm.runInNewContext(codigo, {
    module: mod, exports: mod.exports, require: name => mocks[name] ?? (runtimeMocks[name] ?? require(name)),
    process, console, Buffer, URL, URLSearchParams, Headers, Response, Request, AbortSignal, Date, TextDecoder, ...globals,
  }, { filename: archivo })
  return mod.exports
}

const cedula = cargarTS('lib/cedula.ts')
const util = cargarTS('lib/util.ts')
const estado = cargarTS('components/estado-cedula.tsx', { '@/lib/util': util })
const hook = cargarTS('components/use-consulta-cedula.ts', { '@/lib/cedula': cedula })
const campos = cargarTS('components/campos-identidad.tsx', {
  '@/lib/cedula': cedula, '@/components/estado-cedula': estado, '@/components/use-consulta-cedula': hook,
})

// Existing suites isolate padrón I/O. The dedicated padrón suite exercises the real lookup.
export const mocksCedula = {
  '@/lib/padron': { consultarCedula: async () => ({ estado: 'no_disponible' }) },
  '@/components/campos-identidad': campos,
  '@/components/cedula-admin': { CedulaAdmin: () => null },
}
