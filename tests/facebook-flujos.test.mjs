import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const root = new URL('../', import.meta.url)

function cargar(ruta, mocks = {}) {
  const archivo = new URL(ruta, root)
  const codigo = ts.transpileModule(readFileSync(archivo, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const modulo = { exports: {} }
  const resolver = nombre => nombre in mocks
    ? mocks[nombre]
    : nombre.startsWith('@/')
      ? cargar(`${nombre.slice(2)}.ts`, mocks)
      : require(nombre)
  vm.runInNewContext(codigo, {
    module: modulo,
    exports: modulo.exports,
    require: resolver,
    process,
    console,
    crypto,
    Headers,
    URL,
    URLSearchParams,
    Buffer,
  }, { filename: archivo.pathname })
  return modulo.exports
}

function consulta(responder, tabla) {
  let operacion = 'select'
  let valores
  const filtros = []
  const q = {}
  q.select = () => q
  q.limit = () => q
  for (const metodo of ['eq', 'is', 'ilike']) {
    q[metodo] = (...args) => { filtros.push([metodo, ...args]); return q }
  }
  for (const metodo of ['insert', 'update', 'delete']) {
    q[metodo] = valor => { operacion = metodo; valores = valor; return q }
  }
  const terminar = () => responder({ tabla, operacion, valores, filtros })
  q.maybeSingle = q.single = async () => terminar()
  q.then = (aceptar, rechazar) => Promise.resolve(terminar()).then(aceptar, rechazar)
  return q
}

function redirigir(ruta) {
  const error = new Error('redirect')
  error.ruta = ruta
  throw error
}

const util = cargar('lib/util.ts')
const facebook = cargar('lib/facebook-auth.ts', { '@/lib/util': util })

test('Facebook registration refuses an email-less session before using admin privileges', async () => {
  process.env.AUTH_FACEBOOK = '1'
  let adminSolicitado = false
  const acciones = cargar('lib/actions/auth.ts', {
    'next/headers': {},
    'next/navigation': { redirect: redirigir },
    '@/lib/dal': {},
    '@/lib/supabase/admin': { createAdmin: () => { adminSolicitado = true; return null } },
    '@/lib/supabase/server': {
      sinSupabase: () => false,
      createClient: async () => ({ auth: { getUser: async () => ({ data: { user: {
        id: 'auth-facebook', email: '', app_metadata: { provider: 'facebook' }, user_metadata: {},
      } } }) } }),
    },
  })
  const formulario = new FormData()
  for (const [campo, valor] of Object.entries({
    nombre: 'Persona Atacante', email: 'admin@example.com', cedula: '102340567', facebook: 'perfil.atacante',
  })) formulario.set(campo, valor)
  const resultado = await acciones.completarAltaFacebook(undefined, formulario)
  assert.match(resultado.error, /correo/)
  assert.equal(adminSolicitado, false)
})

test('Facebook registration uses the provider email even if the form submits another address', async () => {
  process.env.AUTH_FACEBOOK = '1'
  let correoGuardado = null
  const admin = {
    auth: { admin: { updateUserById: async () => ({ error: null }) } },
    from: tabla => consulta(({ operacion, valores, filtros }) => {
      if (tabla === 'usuarios') {
        if (operacion === 'insert') {
          correoGuardado = valores.email
          return { data: { id: 42 }, error: null }
        }
        if (filtros.some(filtro => filtro[0] === 'ilike')) return { data: [], error: null }
        return { data: null, error: null }
      }
      return { data: null, error: null }
    }, tabla),
  }
  const acciones = cargar('lib/actions/auth.ts', {
    'next/headers': {},
    'next/navigation': { redirect: redirigir },
    '@/lib/dal': {},
    '@/lib/supabase/admin': { createAdmin: () => admin },
    '@/lib/supabase/server': {
      sinSupabase: () => false,
      createClient: async () => ({ auth: { getUser: async () => ({ data: { user: {
        id: 'auth-facebook', email: 'confirmado@example.com',
        app_metadata: { provider: 'facebook' }, user_metadata: {},
      } } }) } }),
    },
  })
  const formulario = new FormData()
  for (const [campo, valor] of Object.entries({
    nombre: 'Persona Nueva', email: 'falsificado@example.com', cedula: '102340567',
    facebook: 'perfil.nuevo', rol: 'inquilino',
  })) formulario.set(campo, valor)
  await assert.rejects(acciones.completarAltaFacebook(undefined, formulario), error => error.ruta === '/registro/resena')
  assert.equal(correoGuardado, 'confirmado@example.com')
})

test('registration does not take over an unlinked profile', async () => {
  let actualizo = false
  let creoAuth = false
  const admin = {
    auth: { admin: { createUser: async () => { creoAuth = true; return { data: { user: null }, error: null } } } },
    from: tabla => consulta(({ operacion, filtros }) => {
      if (tabla === 'usuarios' && operacion === 'update') {
        actualizo = true
        return { data: { id: 9 }, error: null }
      }
      if (tabla === 'usuarios' && operacion === 'select' && filtros.some((filtro) => filtro[0] === 'ilike')) {
        return { data: [], error: null }
      }
      if (tabla === 'usuarios' && operacion === 'select') {
        return { data: { id: 9, auth_user_id: null }, error: null }
      }
      return { data: null, error: null }
    }, tabla),
  }
  const acciones = cargar('lib/actions/auth.ts', {
    'next/headers': {},
    'next/navigation': { redirect: redirigir },
    '@/lib/dal': {},
    '@/lib/supabase/admin': { createAdmin: () => admin },
    '@/lib/supabase/server': { sinSupabase: () => false, createClient: async () => ({}) },
  })
  const formulario = new FormData()
  for (const [campo, valor] of Object.entries({
    nombre: 'Persona Nueva', email: 'admin@laprotec.test', cedula: '102340567',
    facebook: 'perfil.nuevo', clave: 'clave1234', rol: 'inquilino',
  })) formulario.set(campo, valor)
  const resultado = await acciones.registrarse(undefined, formulario)
  assert.match(resultado.error, /inicie sesión/i)
  assert.equal(actualizo, false)
  assert.equal(creoAuth, false)
})

test('proxy uses current provider after unlinking and rejects deleted accounts', async () => {
  process.env.AUTH_FACEBOOK = '1'
  const { NextRequest } = require('next/server')
  let usuarioActual = { id: 'auth-facebook', app_metadata: { provider: 'email' } }
  let busquedas = 0
  const { proxy } = cargar('proxy.ts', {
    '@/lib/facebook-alta': { altaFacebookLista: async () => { busquedas += 1; return false } },
    '@/lib/facebook-auth': facebook,
    '@/lib/util': util,
    '@/lib/supabase/server': {
      sinSupabase: () => false,
      createClient: async () => ({ auth: {
        getUser: async () => ({ data: { user: usuarioActual } }),
      } }),
    },
  })
  const solicitud = new NextRequest('https://example.com/perfil')
  const vinculada = await proxy(solicitud)
  assert.equal(vinculada.headers.get('location'), null)
  assert.equal(busquedas, 0)

  usuarioActual = null
  const borrada = await proxy(solicitud)
  assert.match(borrada.headers.get('location'), /\/login\?siguiente=%2Fperfil$/)

  usuarioActual = { id: 'auth-facebook', app_metadata: { provider: 'facebook' } }
  const nueva = await proxy(solicitud)
  assert.match(nueva.headers.get('location'), /\/registro\/facebook/)
  assert.equal(busquedas, 1)
})

test('failed Auth deletion restores both the retained account and its public Facebook link', async () => {
  const original = { id: 1, email: 'persona@example.com', activo: true, auth_user_id: 'auth-facebook', avatar_url: null }
  const perfil = { ...original }
  const enlace = { usuario_id: 1, proveedor: 'facebook', proveedor_id: 'https://facebook.com/perfil' }
  let enlaceActual = { ...enlace }
  const admin = {
    rpc: async () => ({ data: 'auth-facebook', error: null }),
    auth: { admin: {
      getUserById: async () => ({ data: { user: { identities: [{ provider: 'facebook' }] } } }),
      deleteUser: async () => ({ error: { message: 'temporary failure' } }),
    } },
    from: tabla => consulta(({ operacion, valores }) => {
      if (tabla === 'usuarios') {
        if (operacion === 'update') Object.assign(perfil, valores)
        return { data: operacion === 'select' ? { ...perfil } : null, error: null }
      }
      if (tabla === 'autenticaciones') {
        if (operacion === 'delete') {
          const borrado = enlaceActual
          enlaceActual = null
          return { data: borrado ? [borrado] : [], error: null }
        }
        if (operacion === 'insert') enlaceActual = { ...valores[0] }
        return { data: null, error: null }
      }
      return { data: null, error: null }
    }, tabla),
  }
  const eliminacion = cargar('lib/facebook-eliminacion-servidor.ts', {
    '@/lib/supabase/admin': { createAdmin: () => admin },
  })
  const resultado = await eliminacion.ejecutarEliminacionFacebook('facebook-id', 'codigo')
  assert.equal(resultado.ok, false)
  assert.equal(perfil.auth_user_id, original.auth_user_id)
  assert.equal(perfil.email, original.email)
  assert.deepEqual(enlaceActual, enlace)
})

test('failed identity unlink restores the public Facebook link', async () => {
  const enlace = { usuario_id: 1, proveedor: 'facebook', proveedor_id: 'https://facebook.com/perfil' }
  let enlaceActual = { ...enlace }
  const admin = {
    rpc: async funcion => funcion === 'buscar_auth_por_facebook'
      ? { data: 'auth-facebook', error: null }
      : { data: false, error: { message: 'temporary failure' } },
    auth: { admin: { getUserById: async () => ({ data: { user: { identities: [
      { provider: 'facebook' }, { provider: 'email' },
    ] } } }) } },
    from: tabla => consulta(({ operacion, valores }) => {
      if (tabla === 'usuarios') return { data: {
        id: 1, email: 'persona@example.com', activo: true, auth_user_id: 'auth-facebook', avatar_url: null,
      }, error: null }
      if (tabla === 'autenticaciones') {
        if (operacion === 'delete') {
          const borrado = enlaceActual
          enlaceActual = null
          return { data: [borrado], error: null }
        }
        if (operacion === 'insert') enlaceActual = { ...valores[0] }
      }
      return { data: null, error: null }
    }, tabla),
  }
  const eliminacion = cargar('lib/facebook-eliminacion-servidor.ts', {
    '@/lib/supabase/admin': { createAdmin: () => admin },
  })
  const resultado = await eliminacion.ejecutarEliminacionFacebook('facebook-id', 'codigo')
  assert.equal(resultado.ok, false)
  assert.deepEqual(enlaceActual, enlace)
})
