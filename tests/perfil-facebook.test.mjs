import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { enlaceFacebook } from '../lib/enlace-facebook.ts'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const modulo = { exports: {} }
const codigo = ts.transpileModule(readFileSync('components/perfil-facebook.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText
vm.runInNewContext(codigo, {
  module: modulo,
  exports: modulo.exports,
  require: nombre => nombre === '@/lib/enlace-facebook' ? { enlaceFacebook } : require(nombre),
})
const { PerfilFacebook } = modulo.exports

test('saved Facebook usernames and shared links are clickable without restricting registration', () => {
  for (const usuario of ['maria.solis', '@maria.solis', ' @maria.solis ']) {
    assert.equal(enlaceFacebook(usuario), 'https://www.facebook.com/maria.solis')
  }
  for (const enlace of [
    'https://www.facebook.com/share/1AbCdEf/?mibextid=wwXIfr',
    'https://m.facebook.com/profile.php?id=100012345',
    'http://web.facebook.com/maria.solis',
  ]) assert.equal(enlaceFacebook(enlace), enlace)
  assert.equal(enlaceFacebook('facebook.com/share/1AbCdEf/'), 'https://facebook.com/share/1AbCdEf/')
})

test('unrecognized text and unsafe URLs stay visible as escaped text instead of links', () => {
  for (const valor of [
    'María Solís', '@@maria.solis', 'javascript:alert(1)', 'data:text/html,hello',
    'https://example.com/maria.solis', 'https://facebook.com.example.com/share/123',
    'https://facebook.com@evil.example/share/123', 'https://user@facebook.com/share/123',
    '<img src=x onerror=alert(1)>',
  ]) {
    assert.equal(enlaceFacebook(valor), null, valor)
    const html = renderToStaticMarkup(createElement(PerfilFacebook, { valor }))
    assert.doesNotMatch(html, /<a\b|<img\b/)
    assert.match(html, /Facebook:/)
  }
  const html = renderToStaticMarkup(createElement(PerfilFacebook, { valor: 'María <Solís>' }))
  assert.match(html, /María &lt;Solís&gt;/)
})

test('Facebook links preserve the new-tab indication and opener protections', () => {
  const html = renderToStaticMarkup(createElement(PerfilFacebook, {
    valor: 'https://facebook.com/share/123', etiqueta: 'Facebook', className: 'text-seal',
  }))
  assert.match(html, /href="https:\/\/facebook.com\/share\/123"/)
  assert.match(html, /target="_blank"/)
  assert.match(html, /rel="noopener noreferrer"/)
  assert.match(html, /se abre en una pestaña nueva/)
})
