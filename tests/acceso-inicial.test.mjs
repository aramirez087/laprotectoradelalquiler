import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const root = new URL('../', import.meta.url)

function cargar(ruta, mocks = {}) {
  const archivo = new URL(ruta, root)
  const codigo = ts.transpileModule(readFileSync(archivo, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText
  const modulo = { exports: {} }
  vm.runInNewContext(codigo, {
    module: modulo,
    exports: modulo.exports,
    require: nombre => nombre in mocks ? mocks[nombre] : require(nombre),
    process,
    URLSearchParams,
  }, { filename: archivo.pathname })
  return modulo.exports
}

function redirigir(ruta) {
  const error = new Error('redirect')
  error.ruta = ruta
  throw error
}

const usuario = { id: 7, auth_user_id: 'auth-7', nombre: 'María Solís', rol: 'propietario', activo: true }
const util = cargar('lib/util.ts')
const acceso = cargar('lib/acceso-consulta.ts')
const comunes = {
  'next/link': ({ href, children, ...props }) => createElement('a', { href, ...props }, children),
  'next/navigation': { redirect: redirigir, usePathname: () => '/' },
  '@/lib/supabase/server': { sinSupabase: () => false },
  '@/lib/util': util,
  '@/lib/acceso-consulta': acceso,
  '@/components/icono': { Icono: () => null },
  '@/components/barrio-vivo': { BarrioVivo: () => null },
  '@/components/aviso-configuracion': { AvisoConfiguracion: () => null },
}

function destinoConResenas(resenas, sesion = usuario) {
  const db = {
    from: () => {
      const consulta = {
        select: () => consulta,
        eq: () => consulta,
        maybeSingle: async () => ({ data: sesion, error: null }),
        then: resolver => resolver({ count: resenas, error: null }),
      }
      return consulta
    },
  }
  return cargar('lib/dal.ts', {
    ...comunes,
    'server-only': {},
    '@/lib/facebook-alta': {},
    '@/lib/facebook-auth': {},
    '@/lib/supabase/admin': { createAdmin: () => db },
  }).destinoTrasLogin
}

const { EstadoAcceso } = cargar('components/espera-aprobacion.tsx', { ...comunes, '@/lib/dal': {} })
const pendiente = {
  usuario_id: usuario.id, puede_consultar: false, aprobadas: 0, pendientes: 1,
  rechazadas: 0, ultima_aprobacion_en: null, vence_en: null, motivo: 'revision',
}

function inicio({ sesion = usuario, resenas = 0, puedeConsultar = false, estadoAcceso = pendiente } = {}) {
  return cargar('app/page.tsx', {
    ...comunes,
    '@/lib/dal': {
      obtenerUsuario: async () => sesion,
      contarResenasPublicadas: async () => null,
      destinoTrasLogin: destinoConResenas(resenas, sesion),
      puedeConsultar: async () => puedeConsultar,
    },
    '@/components/espera-aprobacion': {
      EsperaAprobacion: () => createElement(EstadoAcceso, { acceso: estadoAcceso }),
    },
  }).default
}

test('public home offers sign-in and registration before any search or review form', async () => {
  const html = renderToStaticMarkup(await inicio({ sesion: null })())
  const destinos = [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1])
  assert.deepEqual(destinos.sort(), ['/login', '/registro'])
  assert.match(html, /Iniciar sesión/)
  assert.match(html, /Unirme a La Protectora/)
  assert.match(html, /propietarios y agencias/i)
  assert.doesNotMatch(html, /role="search"|type="search"|<form/)
})

test('signed-in home resumes an account without reviews at its first review', async () => {
  await assert.rejects(inicio()(), error => error.ruta === '/registro/resena')
})

test('home keeps a submitted first review in the waiting state without inviting a duplicate', async () => {
  const html = renderToStaticMarkup(await inicio({ resenas: 1 })())
  assert.match(html, /Su experiencia está en revisión/)
  assert.match(html, /href="\/perfil#mis-resenas"/)
  assert.doesNotMatch(html, /role="search"|href="\/registro\/resena"|href="\/resenas\/nueva"/)
})

test('members with approved current access see the search landing at home', async () => {
  const html = renderToStaticMarkup(await inicio({ resenas: 1, puedeConsultar: true })())
  const formulario = html.match(/<form[^>]*>/)?.[0]
  assert.ok(formulario)
  assert.match(formulario, /action="\/fichas"/)
  assert.match(formulario, /method="get"/i)
  assert.match(formulario, /role="search"/)
  assert.match(html, /Proteja su propiedad/)
  assert.match(html, /<input[^>]*name="q"/)
  assert.doesNotMatch(html, /Mi primera reseña|Su experiencia está en revisión/)
})

test('expired approval shows renewal instructions at home instead of treating the member as active', async () => {
  const html = renderToStaticMarkup(await inicio({
    resenas: 1,
    estadoAcceso: { ...pendiente, aprobadas: 1, pendientes: 0, motivo: 'vencida' },
  })())
  assert.match(html, /Su permiso de consulta venció/)
  assert.match(html, /href="\/resenas\/nueva"/)
  assert.doesNotMatch(html, /href="\/registro\/resena"|role="search"/)
})

test('inactive members still see their inactive-account state at home', async () => {
  const html = renderToStaticMarkup(await inicio({
    sesion: { ...usuario, activo: false },
    estadoAcceso: { ...pendiente, motivo: 'inactiva' },
  })())
  assert.match(html, /Su cuenta está inactiva/)
  assert.doesNotMatch(html, /href="\/registro\/resena"|role="search"/)
})

function login(resenas, sesion = usuario) {
  const { LoginForm } = cargar('components/login-form.tsx', {
    ...comunes,
    '@/components/use-form-action': { useFormAction: () => ({ estado: null, pendiente: false, formProps: {} }) },
    '@/lib/actions/auth': { iniciarSesion: () => {} },
    '@/components/campo-clave': { CampoClave: () => createElement('input', { name: 'clave', type: 'password' }) },
    '@/components/mensaje-form': { MensajeForm: () => null },
  })
  return cargar('app/login/page.tsx', {
    ...comunes,
    'next/headers': { cookies: async () => ({ get: () => undefined }) },
    '@/lib/dal': { obtenerUsuario: async () => sesion, destinoTrasLogin: destinoConResenas(resenas, sesion) },
    '@/lib/facebook-alta': { altaFacebookPendiente: async () => false },
    '@/lib/facebook-auth': { authFacebookHabilitado: () => false, mensajeErrorFacebook: () => null },
    '@/lib/correo-recordado': { COOKIE_CORREO: 'correo', correoRecordado: () => '' },
    '@/components/marco-acceso': { MarcoAcceso: ({ children }) => createElement('main', null, children) },
    '@/components/login-form': { LoginForm },
  }).default
}

test('visiting login while signed in resumes the first review before the requested destination', async () => {
  await assert.rejects(login(0)({ searchParams: Promise.resolve({ siguiente: '/fichas?q=Ana' }) }),
    error => error.ruta === '/registro/resena')
})

test('signed-in login preserves safe destinations after a submission and rejects external destinations', async () => {
  for (const [siguiente, esperado] of [
    ['/fichas?q=Ana', '/fichas?q=Ana'],
    ['/perfil#mis-resenas', '/perfil#mis-resenas'],
    ['https://example.com', '/'],
    ['//example.com', '/'],
    [undefined, '/'],
  ]) {
    await assert.rejects(login(1)({ searchParams: Promise.resolve({ siguiente }) }),
      error => error.ruta === esperado)
  }
})

test('public login form defaults to the search home and preserves explicit search destinations', async () => {
  for (const [siguiente, esperado] of [[undefined, '/'], ['/fichas?q=Ana', '/fichas?q=Ana']]) {
    const html = renderToStaticMarkup(await login(0, null)({ searchParams: Promise.resolve({ siguiente }) }))
    assert.ok(html.includes(`<input type="hidden" name="siguiente" value="${esperado}"/>`))
  }
})

function registro({ sesion = usuario, puedeConsultar = false } = {}) {
  return cargar('app/registro/page.tsx', {
    ...comunes,
    '@/lib/dal': {
      obtenerUsuario: async () => sesion,
      puedeConsultar: async () => puedeConsultar,
    },
    '@/lib/facebook-alta': { altaFacebookPendiente: async () => false },
    '@/lib/facebook-auth': { authFacebookHabilitado: () => false },
    '@/components/marco-acceso': { MarcoAcceso: ({ children }) => createElement('main', null, children) },
    '@/components/registro-form': { RegistroForm: () => createElement('form', { 'aria-label': 'Crear cuenta' }) },
  }).default
}

test('members with approved current access bypass registration and go directly to the search home', async () => {
  await assert.rejects(registro({ puedeConsultar: true })({ searchParams: Promise.resolve({}) }),
    error => error.ruta === '/')
})

test('registration preserves public, first-review, inactive and administrator entry paths', async () => {
  const html = renderToStaticMarkup(await registro({ sesion: null })({ searchParams: Promise.resolve({}) }))
  assert.match(html, /<form aria-label="Crear cuenta"/)
  for (const [sesion, puedeConsultar, esperado] of [
    [usuario, false, '/registro/resena'],
    [{ ...usuario, activo: false }, false, '/registro/resena'],
    [{ ...usuario, rol: 'admin' }, true, '/admin'],
  ]) {
    await assert.rejects(registro({ sesion, puedeConsultar })({ searchParams: Promise.resolve({}) }),
      error => error.ruta === esperado)
  }
})

function primeraResena(resenas = [], { sesion = usuario, puedeConsultar = false } = {}) {
  let perfilCompletado = false
  let resenasConsultadas = false
  const pagina = cargar('app/registro/resena/page.tsx', {
    ...comunes,
    '@/lib/actions/resenas': { crearResenaAction: () => {} },
    '@/lib/dal': {
      requireUsuario: async () => sesion,
      puedeConsultar: async () => puedeConsultar,
      listarResenasDe: async () => { resenasConsultadas = true; return resenas },
      completarPerfilRegistro: async () => { perfilCompletado = true },
    },
    '@/components/form-resena': { FormResena: () => createElement('form', { 'aria-label': 'Escribir reseña' }) },
    '@/components/pasos-registro': cargar('components/pasos-registro.tsx'),
  }).default
  return { pagina, perfilCompletado: () => perfilCompletado, resenasConsultadas: () => resenasConsultadas }
}

test('first-review page presents the review as the second registration step', async () => {
  const { pagina } = primeraResena()
  const html = renderToStaticMarkup(await pagina())
  assert.match(html, /<h1[^>]*>Mi primera reseña<\/h1>/)
  assert.match(html, /aria-current="step"[^>]*>.*Paso 2 de 2/)
  assert.match(html, /<form aria-label="Escribir reseña"/)
})

test('first-review page routes existing submissions to the profile before exposing another form', async () => {
  for (const estado of ['borrador', 'publicada', 'oculta']) {
    const primera = primeraResena([{ id: 1, estado }])
    await assert.rejects(primera.pagina(), error => error.ruta === '/perfil')
    assert.equal(primera.perfilCompletado(), false)
  }
})

test('members with approved current access bypass the first-review page before loading or editing onboarding data', async () => {
  const primera = primeraResena([{ id: 1, estado: 'publicada' }], { puedeConsultar: true })
  await assert.rejects(primera.pagina(), error => error.ruta === '/')
  assert.equal(primera.resenasConsultadas(), false)
  assert.equal(primera.perfilCompletado(), false)
})

test('a stale first-review login destination still sends an approved member to the search home without a form', async () => {
  await assert.rejects(login(1)({ searchParams: Promise.resolve({ siguiente: '/registro/resena' }) }),
    error => error.ruta === '/registro/resena')
  const primera = primeraResena([{ id: 1, estado: 'publicada' }], { puedeConsultar: true })
  await assert.rejects(primera.pagina(), error => error.ruta === '/')
  assert.equal(primera.perfilCompletado(), false)
})

test('an expired published review keeps the existing-submission profile guard', async () => {
  const primera = primeraResena([{ id: 1, estado: 'publicada' }], { puedeConsultar: false })
  await assert.rejects(primera.pagina(), error => error.ruta === '/perfil')
  assert.equal(primera.perfilCompletado(), false)
})

test('the first-review page keeps administrator and inactive-account guards ahead of access routing', async () => {
  const admin = primeraResena([], { sesion: { ...usuario, rol: 'admin' }, puedeConsultar: true })
  await assert.rejects(admin.pagina(), error => error.ruta === '/admin')
  assert.equal(admin.resenasConsultadas(), false)
  assert.equal(admin.perfilCompletado(), false)

  const inactiva = primeraResena([], { sesion: { ...usuario, activo: false } })
  const html = renderToStaticMarkup(await inactiva.pagina())
  assert.match(html, /Su cuenta está inactiva/)
  assert.doesNotMatch(html, /<form/)
  assert.equal(inactiva.resenasConsultadas(), false)
  assert.equal(inactiva.perfilCompletado(), false)
})

test('registration forms only offer owner and agency account types', () => {
  const mocks = {
    ...comunes,
    '@/components/use-form-action': { useFormAction: () => ({ estado: null, pendiente: false, formProps: {} }) },
    '@/lib/actions/auth': { registrarse: () => {}, completarAltaFacebook: () => {}, cerrarSesion: '/salir' },
    '@/components/campo-clave': { CampoClave: () => createElement('input', { name: 'clave', type: 'password' }) },
    '@/components/mensaje-form': { MensajeForm: () => null },
  }
  const { RegistroForm } = cargar('components/registro-form.tsx', mocks)
  const { RegistroFacebookForm } = cargar('components/registro-facebook-form.tsx', mocks)
  for (const componente of [createElement(RegistroForm), createElement(RegistroFacebookForm, {
    nombre: 'María Solís', email: 'maria@example.com', cedula: '', facebook: '', pedirRol: true,
  })]) {
    const html = renderToStaticMarkup(componente)
    const roles = [...html.matchAll(/<input[^>]*name="rol"[^>]*value="([^"]+)"/g)].map(match => match[1])
    assert.deepEqual(roles.sort(), ['agencia', 'propietario'])
    assert.doesNotMatch(html, /inquilino/i)
  }
  const html = renderToStaticMarkup(createElement(RegistroForm))
  assert.match(html, /Crear cuenta y escribir mi primera reseña/)
  assert.match(html, /Iniciar sesión/)
})

test('public navigation offers account entry without search or review links', () => {
  const { Nav } = cargar('components/nav.tsx', {
    ...comunes,
    '@/lib/actions/auth': { cerrarSesion: '/salir' },
    '@/components/marca': { Marca: () => 'La Protectora del Alquiler' },
    '@/components/selector-tema': { SelectorTema: () => null },
  })
  const html = renderToStaticMarkup(createElement(Nav, { usuario: null, tema: 'claro' }))
  const destinos = [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1])
  assert.deepEqual(destinos.sort(), ['/', '/login', '/registro'])
})

test('signed-in navigation returns to the search home and marks search pages as current', () => {
  for (const [ruta, activo] of [['/', true], ['/fichas', true], ['/fichas/7', true], ['/perfil', false]]) {
    const { Nav } = cargar('components/nav.tsx', {
      ...comunes,
      'next/navigation': { usePathname: () => ruta },
      '@/lib/actions/auth': { cerrarSesion: '/salir' },
      '@/components/marca': { Marca: () => 'La Protectora del Alquiler' },
      '@/components/selector-tema': { SelectorTema: () => null },
    })
    const html = renderToStaticMarkup(createElement(Nav, { usuario, tema: 'claro' }))
    const enlace = html.match(/<a[^>]*>Consultar reseñas<\/a>/)?.[0]
    assert.ok(enlace)
    assert.match(enlace, /href="\/"/)
    assert.equal(enlace.includes('aria-current="page"'), activo, ruta)
    assert.equal(enlace.includes('enlace-nav-activo'), activo, ruta)
  }
})
