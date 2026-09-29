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

function destinoConResenas(resenas) {
  const db = {
    from: () => {
      const consulta = {
        select: () => consulta,
        eq: () => consulta,
        maybeSingle: async () => ({ data: usuario, error: null }),
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

function inicio({ sesion = usuario, resenas = 0, puedeConsultar = false } = {}) {
  return cargar('app/page.tsx', {
    ...comunes,
    '@/lib/dal': {
      obtenerUsuario: async () => sesion,
      destinoTrasLogin: destinoConResenas(resenas),
      puedeConsultar: async () => puedeConsultar,
    },
    '@/components/espera-aprobacion': {
      EsperaAprobacion: () => createElement(EstadoAcceso, { acceso: pendiente }),
    },
  }).default
}

test('public home offers sign-in and registration before any search or review form', async () => {
  const html = renderToStaticMarkup(await inicio({ sesion: null })())
  const destinos = [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1])
  assert.deepEqual(destinos.sort(), ['/login', '/registro'])
  assert.match(html, /Iniciar sesión/)
  assert.match(html, /Registrarse/)
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

test('approved members can search the registry from home', async () => {
  const html = renderToStaticMarkup(await inicio({ resenas: 1, puedeConsultar: true })())
  const formulario = html.match(/<form[^>]*>/)?.[0] ?? ''
  assert.match(formulario, /action="\/fichas"/)
  assert.match(formulario, /role="search"/)
  assert.match(html, /name="q"/)
  assert.match(html, /href="\/resenas\/nueva"/)
})

function login(resenas) {
  return cargar('app/login/page.tsx', {
    ...comunes,
    'next/headers': { cookies: async () => ({ get: () => undefined }) },
    '@/lib/dal': { obtenerUsuario: async () => usuario, destinoTrasLogin: destinoConResenas(resenas) },
    '@/lib/facebook-alta': { altaFacebookPendiente: async () => false },
    '@/lib/facebook-auth': {},
    '@/lib/correo-recordado': { COOKIE_CORREO: 'correo', correoRecordado: () => '' },
    '@/components/marco-acceso': {},
    '@/components/login-form': {},
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
    ['https://example.com', '/fichas'],
    ['//example.com', '/fichas'],
    [undefined, '/fichas'],
  ]) {
    await assert.rejects(login(1)({ searchParams: Promise.resolve({ siguiente }) }),
      error => error.ruta === esperado)
  }
})

function primeraResena(resenas = []) {
  let perfilCompletado = false
  const pagina = cargar('app/registro/resena/page.tsx', {
    ...comunes,
    '@/lib/actions/resenas': { crearResenaAction: () => {} },
    '@/lib/dal': {
      requireUsuario: async () => usuario,
      listarResenasDe: async () => resenas,
      completarPerfilRegistro: async () => { perfilCompletado = true },
    },
    '@/components/form-resena': { FormResena: () => createElement('form', { 'aria-label': 'Escribir reseña' }) },
    '@/components/pasos-registro': cargar('components/pasos-registro.tsx'),
  }).default
  return { pagina, perfilCompletado: () => perfilCompletado }
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
