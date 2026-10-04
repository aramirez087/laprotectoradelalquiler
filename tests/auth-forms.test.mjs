import { runtimeMocks } from './helpers/runtime-mocks.mjs'
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
  vm.runInNewContext(code, { module: mod, exports: mod.exports, require: name => mocks[name] ?? (runtimeMocks[name] ?? require(name)), console, URLSearchParams }, { filename: file })
  return mod.exports
}

function render(component, { estado, pendiente = false, props = {} } = {}) {
  const noEnviar = async () => { throw new Error('Tests must not submit authentication requests') }
  const base = {
    '@/components/use-form-action': { useFormAction: () => ({ estado, pendiente, formProps: { onSubmit() {}, 'aria-busy': pendiente } }) },
    '@/lib/actions/auth': { iniciarSesion: noEnviar, registrarse: noEnviar, cambiarClave: noEnviar, confirmarCorreoPendiente: noEnviar },
    '@/components/mensaje-form': load('components/mensaje-form.tsx'),
    '@/components/campo-clave': load('components/campo-clave.tsx'),
    '@/components/enlace': ({ href, children, ...attrs }) => createElement('a', { href, ...attrs }, children),
    '@/components/campos-identidad': { CamposIdentidad: () => createElement('input', { name: 'nombre', autoComplete: 'name' }) },
  }
  base['@/components/confirmar-correo-form'] = load('components/confirmar-correo-form.tsx', {
    ...base,
    '@/components/use-form-action': { useFormAction: () => ({ estado: undefined, pendiente: false, formProps: { onSubmit() {} } }) },
  })
  const [file, nombre] = component
  return renderToStaticMarkup(createElement(load(file, base)[nombre], props))
}

const login = ['components/login-form.tsx', 'LoginForm']
const registro = ['components/registro-form.tsx', 'RegistroForm']
const clave = ['components/form-clave.tsx', 'FormClave']

test('login carries email and destination to signup and password recovery', () => {
  const html = render(login, { props: { correo: 'persona@example.com', siguiente: '/resenas/nueva?ficha=123' } })
  const query = 'siguiente=%2Fresenas%2Fnueva%3Fficha%3D123&amp;correo=persona%40example.com'
  assert.ok(html.includes(`href="/recuperar?${query}"`))
  assert.ok(html.includes(`href="/registro?${query}"`))
  assert.match(html, /autocomplete="username"/i)
  assert.match(html, /autocomplete="current-password"/i)
  assert.match(html, /Crear una cuenta/)
})

test('expired confirmation can render resend without a prior login submission', () => {
  const html = render(login, { props: { siguiente: '/', confirmarCorreo: true, correo: 'persona@example.com' } })
  assert.match(html, /Confirmar su correo/)
  assert.match(html, /name="email"[^>]*value="persona@example.com"/)
  assert.match(html, /Enviar otro correo de confirmación/)
  assert.equal((html.match(/<form\b/g) ?? []).length, 1)
  assert.ok(!html.includes('name="clave"'))
  assert.ok(!html.includes('Crear una cuenta'))
  assert.match(html, /class="btn-primario w-full"/)
  assert.match(html, /Volver a iniciar sesión/)
})

test('an unconfirmed login foregrounds resend with no competing password form', () => {
  const html = render(login, {
    estado: { error: 'Confirme su correo.', confirmarCorreo: true, email: 'persona@example.com' },
    props: { siguiente: '/resenas/nueva', correo: 'persona@example.com' },
  })
  assert.equal((html.match(/<form\b/g) ?? []).length, 1)
  assert.ok(!html.includes('name="clave"'))
  assert.match(html, /href="\/login\?siguiente=%2Fresenas%2Fnueva&amp;correo=persona%40example.com"/)
})

test('changing login email hides a prior account-specific failure and confirmation resend', () => {
  const html = render(login, {
    estado: { error: 'Confirme el correo anterior.', confirmarCorreo: true, email: 'anterior@example.com' },
    props: { siguiente: '/', correo: 'nueva@example.com' },
  })
  assert.ok(!html.includes('Confirme el correo anterior'))
  assert.ok(!html.includes('Enviar otro correo de confirmación'))
})

test('signup clearly routes existing accounts before identity fields', () => {
  const html = render(registro, { props: { correo: 'persona@example.com', siguiente: '/resenas/nueva' } })
  assert.ok(html.indexOf('No necesita crear otra cuenta') < html.indexOf('name="nombre"'))
  assert.match(html, /href="\/recuperar\?siguiente=%2Fresenas%2Fnueva&amp;correo=persona%40example.com"/)
  assert.match(html, /name="siguiente" value="\/resenas\/nueva"/)
  assert.ok(html.indexOf('>Crear cuenta</button>') < html.indexOf('desde que administración la aprueba'))
})

test('signup success replaces account fields and submit with confirmation guidance', () => {
  const html = render(registro, { estado: { mensaje: 'Revise su correo.', email: 'persona@example.com' }, props: { siguiente: '/', correo: 'persona@example.com' } })
  assert.match(html, /role="status" tabindex="-1"/)
  assert.match(html, /Ya confirmé mi correo: iniciar sesión/)
  assert.match(html, /<details(?![^>]*\bopen)[^>]*><summary[^>]*>No recibí el mensaje<\/summary>[\s\S]*Enviar otro correo de confirmación[\s\S]*<\/details>/)
  assert.ok(html.indexOf('Ya confirmé mi correo: iniciar sesión') < html.indexOf('<details'))
  assert.ok(!html.includes('name="nombre"'))
  assert.ok(!html.includes('name="clave"'))
  assert.ok(!html.includes('>Crear cuenta</button>'))
})

test('password recovery success requires an explicit continuation after feedback', () => {
  const html = render(clave, { estado: { mensaje: 'Su clave se actualizó.', destino: '/registro/resena' }, props: { siguiente: '/resenas/nueva', enlaceRecuperacion: '/recuperar?siguiente=%2Fresenas%2Fnueva' } })
  assert.match(html, /role="status" tabindex="-1"/)
  assert.match(html, /href="\/registro\/resena"[^>]*>Continuar con mi cuenta/)
  assert.ok(!html.includes('name="clave"'))
  assert.ok(!html.includes('name="confirmacion"'))
  assert.ok(!html.includes('Solicitar otro enlace'))
})

test('password-save failure offers another recovery link with the original destination', () => {
  const html = render(clave, { estado: { error: 'El enlace venció.' }, props: { enlaceRecuperacion: '/recuperar?siguiente=%2Fresenas%2Fnueva' } })
  assert.match(html, /role="alert" tabindex="-1"/)
  assert.match(html, /href="\/recuperar\?siguiente=%2Fresenas%2Fnueva"/)
  assert.match(html, /Solicitar otro enlace de recuperación/)
})

test('pending password save keeps values readonly and hides stale results', () => {
  const html = render(clave, { pendiente: true, estado: { error: 'Error anterior' } })
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /<input(?=[^>]*name="clave")(?=[^>]*readonly="")[^>]*>/i)
  assert.match(html, /type="submit" disabled=""/)
  assert.match(html, /Guardando…/)
  assert.ok(!html.includes('Error anterior'))
})
