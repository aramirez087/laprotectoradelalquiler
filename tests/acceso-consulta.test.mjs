import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as acceso from '../lib/acceso-consulta.ts'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const mod = { exports: {} }
const mocks = {
  'next/link': ({ href, children, ...props }) => createElement('a', { href, ...props }, children),
  '@/lib/dal': {},
  '@/lib/acceso-consulta': acceso,
  '@/components/icono': { Icono: () => createElement('span') },
}
vm.runInNewContext(ts.transpileModule(readFileSync('components/espera-aprobacion.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, { module: mod, exports: mod.exports, require: name => mocks[name] ?? require(name) })

const base = { usuario_id: 1, puede_consultar: false, aprobadas: 1, pendientes: 0, rechazadas: 0, ultima_aprobacion_en: '2025-01-01T12:00:00Z', vence_en: '2025-02-01T12:00:00Z', motivo: 'vencida' }
const render = overrides => renderToStaticMarkup(createElement(mod.exports.EstadoAcceso, { acceso: { ...base, ...overrides } }))

test('expired members see the expiry and a renewal link instead of restarting registration', () => {
  const html = render({})
  assert.match(html, /Su permiso de consulta venció/)
  assert.match(html, /2025/)
  assert.match(html, /hora de Costa Rica/)
  assert.match(html, /href="\/resenas\/nueva"/)
  assert.doesNotMatch(html, /href="\/registro\/resena"/)
  assert.match(html, /1 mes/)
  assert.match(html, /6 meses/)
  assert.match(html, /1 año/)
})
test('pending renewals keep users informed and link to their existing reviews', () => {
  const html = render({ pendientes: 1 })
  assert.match(html, /Tiene una reseña en revisión/)
  assert.match(html, /href="\/perfil"/)
  assert.doesNotMatch(html, /href="\/registro\/resena"/)
})
test('database errors and inactive accounts do not encourage unnecessary submissions', () => {
  for (const motivo of ['error', 'inactiva']) {
    const html = render({ motivo })
    assert.match(html, /href="\/perfil"/)
    assert.doesNotMatch(html, /href="\/resenas\/nueva"|href="\/registro\/resena"/)
  }
})
test('first-time users are directed to the first-review step', () => {
  const html = render({ motivo: 'ninguna', aprobadas: 0, vence_en: null })
  assert.match(html, /href="\/registro\/resena"/)
  assert.match(html, /tendrá 1 mes/)
})
test('expiry display has an explicit Costa Rica timezone regardless of server locale', () => {
  assert.match(acceso.fechaVencimiento('2025-02-01T02:00:00Z'), /31 de enero de 2025/)
  assert.match(acceso.mensajeAcceso({ ...base, puede_consultar: true, motivo: 'vigente' }), /Puede consultar hasta/)
})
