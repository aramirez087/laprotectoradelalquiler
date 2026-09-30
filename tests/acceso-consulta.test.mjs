import { runtimeMocks } from './helpers/runtime-mocks.mjs'
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
  '@/components/enlace': ({ href, children, ...props }) => createElement('a', { href, ...props }, children),
  '@/lib/dal': {},
  '@/lib/acceso-consulta': acceso,
  '@/components/icono': { Icono: () => createElement('span') },
}
vm.runInNewContext(ts.transpileModule(readFileSync('components/espera-aprobacion.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, { module: mod, exports: mod.exports, require: name => mocks[name] ?? (runtimeMocks[name] ?? require(name)) })

const base = { usuario_id: 1, puede_consultar: false, aprobadas: 1, pendientes: 0, rechazadas: 0, ultima_aprobacion_en: '2025-01-01T12:00:00Z', vence_en: '2025-02-01T12:00:00Z', motivo: 'vencida' }
const render = overrides => renderToStaticMarkup(createElement(mod.exports.EstadoAcceso, { acceso: { ...base, ...overrides } }))

const permisoMod = { exports: {} }
vm.runInNewContext(ts.transpileModule(readFileSync('components/permiso-consulta.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, {
  module: permisoMod, exports: permisoMod.exports,
  require: name => name === 'next/navigation' ? { useRouter: () => ({ refresh() {} }) } : mocks[name] ?? (runtimeMocks[name] ?? require(name)),
})
const ahoraServidor = Date.parse('2025-01-15T12:00:00Z')
const panel = overrides => renderToStaticMarkup(createElement(permisoMod.exports.PanelPermiso, {
  acceso: { ...base, motivo: 'vigente', puede_consultar: true, pendientes: 2, rechazadas: 1, ...overrides }, ahoraServidor,
}))

test('expired members see the expiry and a renewal link instead of restarting registration', () => {
  const html = render({})
  assert.match(html, /Su permiso de consulta venció/)
  assert.match(html, /2025/)
  assert.match(html, /hora de Costa Rica/)
  assert.match(html, /href="\/resenas\/nueva"/)
  assert.doesNotMatch(html, /href="\/registro\/resena"/)
  assert.match(html, /3 meses/)
  assert.match(html, /máximo de 12 meses/)
})
test('pending renewals keep users informed and link to their existing reviews', () => {
  const html = render({ pendientes: 1 })
  assert.match(html, /Tiene una reseña en revisión/)
  assert.match(html, /href="\/perfil#mis-resenas"/)
  assert.match(html, /href="\/resenas\/nueva"/)
  assert.match(html, /No necesita reenviar la misma experiencia/)
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
  assert.match(html, /tendrá 3 meses/)
})
test('expiry display has an explicit Costa Rica timezone regardless of server locale', () => {
  assert.match(acceso.fechaVencimiento('2025-02-01T02:00:00Z'), /31 de enero de 2025/)
  assert.match(acceso.mensajeAcceso({ ...base, puede_consultar: true, motivo: 'vigente' }), /Puede consultar hasta/)
})
test('time left uses whole days or hours without displaying zero days for active access', () => {
  for (const [delta, expected] of [
    [86_400_000 * 12 + 500, '12 días'], [86_400_000, '1 día'],
    [86_400_000 - 1, '23 horas'], [3_600_000, '1 hora'],
    [1000, 'Menos de 1 hora'], [0, 'Acceso vencido'], [-1, 'Acceso vencido'],
  ]) assert.equal(acceso.tiempoRestante(new Date(ahoraServidor + delta).toISOString(), ahoraServidor), expected)
  assert.equal(acceso.tiempoRestante('invalid', ahoraServidor), 'Por verificar')
})
test('profile shows time left, expiry, distinct contributions and the approval requirement', () => {
  const html = panel({})
  for (const text of ['17 días', 'Acceso activo', 'hora de Costa Rica', 'Experiencias aprobadas', 'Reseñas en revisión', 'Reseñas no aprobadas', '3 meses', '12 meses', 'no al enviar', 'positivas y negativas']) {
    assert.ok(html.includes(text), text)
  }
  assert.match(html, /href="\/fichas"/)
  assert.match(html, /Actualizar estado/)
})
test('soon-to-expire access has a warning and expired snapshots stop promising access', () => {
  assert.match(panel({ vence_en: '2025-01-16T12:00:00Z' }), /vence pronto/)
  const html = panel({ vence_en: '2025-01-15T12:00:00Z', pendientes: 0 })
  assert.match(html, /Acceso vencido/)
  assert.doesNotMatch(html, /Tiempo disponible|href="\/fichas"/)
  assert.match(html, /Compartir otra experiencia/)
})
test('a pending review leads to the existing contribution instead of another submission', () => {
  for (const motivo of ['revision', 'vencida']) {
    const html = panel({ motivo, puede_consultar: false, pendientes: 1 })
    assert.match(html, /href="#mis-resenas"/)
    assert.match(html, /no necesita enviarla otra vez/)
    assert.doesNotMatch(html, /href="\/resenas\/nueva"|href="\/registro\/resena"/)
  }
  assert.match(readFileSync('app/perfil/page.tsx', 'utf8'), /id="mis-resenas"/)
})
test('error, inactive and admin states do not show misleading reward balances', () => {
  for (const motivo of ['error', 'inactiva', 'administracion']) {
    const html = panel({ motivo })
    assert.doesNotMatch(html, /Tiempo disponible|Experiencias aprobadas|Compartir otra experiencia/)
  }
})
test('the site-wide indicator links to the permission explanation and contributions', () => {
  const html = renderToStaticMarkup(createElement(permisoMod.exports.FranjaPermiso, {
    acceso: { ...base, motivo: 'vigente', puede_consultar: true }, ahoraServidor,
  }))
  assert.match(html, /17 días de acceso/)
  assert.match(html, /href="\/perfil#acceso-consultas"/)
})
