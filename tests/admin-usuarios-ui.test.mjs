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
  vm.runInNewContext(code, { module: mod, exports: mod.exports, require: name => mocks[name] ?? require(name), console, URL, URLSearchParams, Date, Intl }, { filename: file })
  return mod.exports
}
const noop = async () => undefined
const util = load('lib/util.ts')
function mocks({ estado, pendiente = false } = {}) {
  return {
    '@/components/use-form-action': { useFormAction: () => ({ estado, pendiente, formProps: { ref: { current: null }, onSubmit() {}, 'aria-busy': pendiente } }) },
    '@/components/avisos-admin': { useAvisoAdmin: () => () => {} },
    '@/components/use-borrador-admin': load('components/use-borrador-admin.tsx', { '@/lib/borradores-admin': load('lib/borradores-admin.ts') }),
    '@/components/mensaje-form': load('components/mensaje-form.tsx'),
    '@/components/protector-edicion-admin': load('components/protector-edicion-admin.tsx'),
    '@/lib/util': util,
    '@/lib/actions/admin': { decidirResenaAction: noop, editarResenaAction: noop, eliminarResenaAction: noop, guardarUsuarioAction: noop, guardarDatosUsuarioAction: noop, resolverDenunciaAction: noop },
    '@/lib/actions/invitaciones': { invitarAdminAction: noop, cancelarInvitacionAdminAction: noop },
    'next/link': ({ href, children, ...props }) => createElement('a', { href, ...props }, children),
  }
}
const usuario = { id: 12, nombre: 'Ana Pérez', rol: 'propietario', activo: true, version: '2026-09-30T00:00:00.000Z' }

test('regular account edits carry the loaded version and do not expose administrator elevation', () => {
  const { FormUsuario } = load('components/admin-formularios.tsx', mocks())
  const html = renderToStaticMarkup(createElement(FormUsuario, usuario))
  assert.match(html, /name="version" value="2026-09-30T00:00:00.000Z"/)
  assert.match(html, /aria-label="Editar permisos de Ana Pérez"/)
  assert.ok(!html.includes('<option value="admin"'))
  assert.match(html, /value="propietario" selected/)
  assert.match(html, /Cancelar edición/)
  assert.match(html, /aria-labelledby="confirmar-usuario-12"/)
  assert.match(html, /aria-describedby="confirmar-usuario-ayuda-12"/)
  assert.match(html, /Tiene cambios sin guardar/)
})

test('existing administrator and historical roles can be preserved without forcing a different role', () => {
  const { FormUsuario } = load('components/admin-formularios.tsx', mocks())
  for (const rol of ['admin', 'inquilino']) {
    const html = renderToStaticMarkup(createElement(FormUsuario, { ...usuario, rol }))
    assert.match(html, new RegExp(`value="${rol}" selected`))
    assert.ok(!html.includes('Seleccione un rol vigente'))
  }
})

test('pending permission updates disable the entire editable fieldset', () => {
  const { FormUsuario } = load('components/admin-formularios.tsx', mocks({ pendiente: true }))
  const html = renderToStaticMarkup(createElement(FormUsuario, usuario))
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /<fieldset disabled=""/)
  assert.match(html, /Guardando los permisos…/)
})

test('access invitations explicitly preserve the role and require confirmation with distinct field ids', () => {
  const { FormInvitacionAdmin } = load('components/form-invitacion-admin.tsx', mocks())
  const html = renderToStaticMarkup(createElement('div', null,
    createElement(FormInvitacionAdmin, { habilitada: true, initialNombre: 'Ana Pérez', initialEmail: 'ana@example.test', proposito: 'acceso' }),
    createElement(FormInvitacionAdmin, { habilitada: true }),
  ))
  assert.match(html, /name="proposito" value="acceso"/)
  assert.match(html, /Conservará su rol y sus permisos actuales/)
  assert.match(html, /<input(?=[^>]*name="confirmar")(?=[^>]*required="")[^>]*>/)
  assert.match(html, /Generar enlace de acceso/)
  assert.match(html, /Generar invitación de administración/)
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
  assert.equal(new Set(ids).size, ids.length)
})

test('created invitation output identifies the recipient, purpose and maximum expiry', () => {
  const { FormInvitacionAdmin } = load('components/form-invitacion-admin.tsx', mocks({ estado: { mensaje: 'Creada.', invitacion: { enlace: 'https://example.test/invitacion?id=1', email: 'ana@example.test', proposito: 'acceso', venceEn: '2026-10-01T18:00:00Z' } } }))
  const html = renderToStaticMarkup(createElement(FormInvitacionAdmin, { habilitada: true }))
  assert.match(html, /Enlace para ana@example.test/)
  assert.match(html, /podrá iniciar sesión con su rol actual/)
  assert.match(html, /dateTime="2026-10-01T18:00:00Z"/)
  assert.match(html, /hora de Costa Rica/)
  assert.match(html, /Copiar enlace/)
})

test('invitation management keeps filters in renewal links and only revokes pending links', () => {
  const common = mocks()
  common['@/components/paginacion'] = load('components/paginacion.tsx', common)
  const { InvitacionesAdmin } = load('components/invitaciones-admin.tsx', common)
  const filas = ['pendiente', 'aceptada', 'vencida', 'revocada'].map((estado, index) => ({
    id: String(index), nombre: `Persona ${index}`, email: `${index}@example.test`, proposito: 'acceso', estado,
    creado_en: '2026-09-29T18:00:00Z', vence_en: '2026-09-30T18:00:00Z', aceptada_en: null, revocada_en: null,
    invitador_nombre: 'Administradora', enviada_en: null, error_envio_en: null,
  }))
  const html = renderToStaticMarkup(createElement(InvitacionesAdmin, { filas, total: 4, pagina: 1, porPagina: 10, hrefBase: '/admin/usuarios?q=Ana&rol=agencia&estado=activas' }))
  const renewals = [...html.matchAll(/href="([^"]*renovarInvitacion[^"]*)"/g)].map(match => new URL(match[1].replaceAll('&amp;', '&'), 'https://example.test'))
  assert.equal(renewals.length, 3)
  for (const url of renewals) {
    assert.equal(url.searchParams.get('q'), 'Ana')
    assert.equal(url.searchParams.get('rol'), 'agencia')
    assert.equal(url.searchParams.get('estado'), 'activas')
    assert.equal(url.searchParams.get('proposito'), 'acceso')
  }
  assert.equal([...html.matchAll(/aria-label="Revocar invitación de/g)].length, 1)
  assert.match(html, /name="confirmar" value="1"/)
})
