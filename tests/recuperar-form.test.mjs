import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const ts = require('typescript')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  vm.runInNewContext(code, { module: mod, exports: mod.exports, require: name => mocks[name] ?? require(name), console }, { filename: file })
  return mod.exports
}
function render({ estado, pendiente = false } = {}) {
  const { RecuperarForm } = load('components/recuperar-form.tsx', {
    '@/components/use-form-action': { useFormAction: () => ({ estado, pendiente, formProps: { onSubmit() {}, 'aria-busy': pendiente } }) },
    '@/lib/actions/auth': { solicitarRecuperacion: async () => { throw new Error('Tests must not send recovery requests') } },
    '@/components/mensaje-form': load('components/mensaje-form.tsx'),
    'next/link': ({ href, children, ...props }) => createElement('a', { href, ...props }, children),
  })
  return renderToStaticMarkup(createElement(RecuperarForm))
}

test('successful recovery response retains an editable email and retry/correction actions', () => {
  const html = render({ estado: { mensaje: 'Si el correo corresponde a una cuenta, podrá recibir un enlace.' } })
  assert.match(html, /<input[^>]*name="email"/)
  assert.match(html, /Solicitar otro enlace/)
  assert.match(html, /Corregir correo/)
  assert.match(html, /role="status" tabindex="-1"/)
  assert.match(html, /Si no encuentra el mensaje/)
  assert.match(html, /correo no deseado/)
  assert.match(html, /Si recibe varios mensajes/)
  assert.ok(!html.includes('Le enviamos'))
  assert.match(html, /href="\/login"/)
})

test('pending recovery disables email editing and submission without repeating old success', () => {
  const html = render({ pendiente: true, estado: { mensaje: 'Respuesta anterior' } })
  assert.match(html, /<input(?=[^>]*name="email")(?=[^>]*disabled="")[^>]*>/)
  assert.match(html, /<button disabled=""/)
  assert.match(html, /Solicitando enlace…/)
  assert.match(html, /aria-busy="true"/)
  assert.ok(!html.includes('Respuesta anterior'))
})

test('recoverable errors preserve retry form and use a focusable error announcement', () => {
  const html = render({ estado: { error: 'Espere un momento antes de pedir otro enlace.' } })
  assert.match(html, /role="alert" tabindex="-1"/)
  assert.match(html, /Espere un momento/)
  assert.match(html, /<input[^>]*name="email"/)
  assert.match(html, /Solicitar enlace de recuperación/)
  assert.match(html, /for="recuperacion-email"/)
  assert.match(html, /aria-describedby="recuperacion-email-ayuda"/)
})
