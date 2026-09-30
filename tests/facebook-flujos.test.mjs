import { runtimeMocks } from './helpers/runtime-mocks.mjs'
import { mocksCedula } from './helpers/cedula-mocks.mjs'
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
    : nombre in mocksCedula ? mocksCedula[nombre] : nombre.startsWith('@/')
      ? cargar(`${nombre.slice(2)}.ts`, mocks)
      : (runtimeMocks[nombre] ?? require(nombre))
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
    'next/headers': { headers: async () => new Headers({ host: 'www.protectoradelalquiler.com' }) },
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
    'next/headers': { headers: async () => new Headers({ host: 'www.protectoradelalquiler.com' }) },
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
    facebook: 'perfil.nuevo', rol: 'propietario',
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
    'next/headers': { headers: async () => new Headers({ host: 'www.protectoradelalquiler.com' }) },
    'next/navigation': { redirect: redirigir },
    '@/lib/dal': {},
    '@/lib/supabase/admin': { createAdmin: () => admin },
    '@/lib/supabase/server': { sinSupabase: () => false, createClient: async () => ({}) },
  })
  const formulario = new FormData()
  for (const [campo, valor] of Object.entries({
    nombre: 'Persona Nueva', email: 'admin@laprotec.test', cedula: '102340567',
    facebook: 'perfil.nuevo', clave: 'clave1234', rol: 'propietario',
  })) formulario.set(campo, valor)
  const resultado = await acciones.registrarse(undefined, formulario)
  assert.match(resultado.error, /inicie sesión/i)
  assert.equal(actualizo, false)
  assert.equal(creoAuth, false)
})

function registroConRol({ existente = null, signupError = null } = {}) {
  const escrituras = []
  let solicitudesAdmin = 0
  const admin = {
    auth: { admin: {
      createUser: async input => {
        escrituras.push({ tabla: 'auth', operacion: 'insert', valores: input })
        return { data: { user: { id: 'auth-nueva' } }, error: null }
      },
      updateUserById: async (_id, input) => {
        escrituras.push({ tabla: 'auth', operacion: 'update', valores: input })
        return { error: null }
      },
    } },
    from: tabla => consulta(({ operacion, valores, filtros }) => {
      if (operacion !== 'select') escrituras.push({ tabla, operacion, valores })
      if (tabla === 'usuarios') {
        if (operacion === 'insert' || operacion === 'update') return { data: { id: 42 }, error: null }
        if (filtros.some(filtro => filtro[0] === 'ilike')) return { data: [], error: null }
        return { data: existente, error: null }
      }
      return { data: null, error: null }
    }, tabla),
  }
  const acciones = cargar('lib/actions/auth.ts', {
    'next/headers': { headers: async () => new Headers({ host: 'www.protectoradelalquiler.com' }) },
    'next/navigation': { redirect: redirigir },
    '@/lib/dal': {},
    '@/lib/supabase/admin': { createAdmin: () => { solicitudesAdmin += 1; return admin } },
    '@/lib/supabase/server': {
      sinSupabase: () => false,
      createClient: async () => ({ auth: {
        signUp: async input => {
          escrituras.push({ tabla: 'auth', operacion: 'signup', valores: input })
          return { data: { user: { id: 'auth-nueva' }, session: null }, error: signupError }
        },
        signInWithPassword: async () => ({ error: null }),
        getUser: async () => ({ data: { user: {
          id: 'auth-nueva', email: 'persona@example.com',
          app_metadata: { provider: 'facebook' }, user_metadata: {},
        } } }),
      } }),
    },
  })
  return { acciones, escrituras, solicitudesAdmin: () => solicitudesAdmin }
}

function formularioConRol(rol) {
  const formulario = new FormData()
  for (const [campo, valor] of Object.entries({
    nombre: 'Persona Nueva', email: 'persona@example.com', cedula: '102340567',
    facebook: 'perfil.nuevo', clave: 'clave1234',
  })) formulario.set(campo, valor)
  if (rol !== undefined) formulario.set('rol', rol)
  return formulario
}

test('password and Facebook registration reject tenant and forged roles before privileged access', async () => {
  process.env.AUTH_FACEBOOK = '1'
  for (const accion of ['registrarse', 'completarAltaFacebook']) {
    for (const rol of ['inquilino', 'admin', 'otro']) {
      const registro = registroConRol()
      const resultado = await registro.acciones[accion](undefined, formularioConRol(rol))
      assert.match(resultado.error, /propietario o agencia/)
      assert.equal(registro.solicitudesAdmin(), 0)
      assert.equal(registro.escrituras.length, 0)
    }
  }
})

test('owners and agencies can register through either method and continue to their first review', async () => {
  process.env.AUTH_FACEBOOK = '1'
  for (const accion of ['registrarse', 'completarAltaFacebook']) {
    for (const rol of ['propietario', 'agencia']) {
      const registro = registroConRol()
      if (accion === 'registrarse') {
        const resultado = await registro.acciones.registrarse(undefined, formularioConRol(rol))
        assert.match(resultado.mensaje, /confirme su cuenta/)
        assert.equal(registro.escrituras.some(e => e.tabla !== 'auth'), false)
        const solicitud = registro.escrituras[0].valores
        assert.equal(solicitud.options.data.rol, rol)
        assert.equal(solicitud.email_confirm, undefined)
        assert.match(solicitud.options.emailRedirectTo, /auth\/confirmar\?next=\/registro\/resena$/)
        continue
      }
      await assert.rejects(registro.acciones[accion](undefined, formularioConRol(rol)), error => error.ruta === '/registro/resena')
      const perfil = registro.escrituras.find(escritura => escritura.tabla === 'usuarios')
      assert.equal(perfil.valores.rol, rol)
      const auth = registro.escrituras.find(escritura => escritura.tabla === 'auth')
      assert.equal(auth.valores.user_metadata.rol, rol)
    }
  }
})

test('both registration methods accept Facebook names and shared links without requiring a profile format', async () => {
  process.env.AUTH_FACEBOOK = '1'
  for (const accion of ['registrarse', 'completarAltaFacebook']) {
    for (const [entrada, esperado] of [
      ['  @maria.solis  ', '@maria.solis'],
      ['  María Solís  ', 'María Solís'],
      ['  https://www.facebook.com/share/1Example/?mibextid=wwXIfr  ', 'https://www.facebook.com/share/1Example/?mibextid=wwXIfr'],
      [`https://www.facebook.com/share/1Example/?tracking=${'x'.repeat(300)}`, `https://www.facebook.com/share/1Example/?tracking=${'x'.repeat(300)}`],
      ['  maria.solis  ', 'https://www.facebook.com/maria.solis'],
    ]) {
      const registro = registroConRol()
      const formulario = formularioConRol('propietario')
      formulario.set('facebook', entrada)
      if (accion === 'registrarse') {
        const resultado = await registro.acciones.registrarse(undefined, formulario)
        assert.match(resultado.mensaje, /confirme su cuenta/)
        assert.equal(registro.escrituras[0].valores.options.data.facebook, esperado)
        assert.equal(registro.escrituras.some(e => e.tabla !== 'auth'), false)
        continue
      }
      await assert.rejects(registro.acciones[accion](undefined, formulario), error => error.ruta === '/registro/resena')
      const enlace = registro.escrituras.find(escritura => escritura.tabla === 'autenticaciones')
      assert.equal(enlace.valores.proveedor, 'facebook')
      assert.equal(enlace.valores.proveedor_id, esperado, `${accion}: ${entrada}`)
      const auth = registro.escrituras.find(escritura => escritura.tabla === 'auth')
      assert.equal(auth.valores.user_metadata.facebook, esperado, `${accion}: metadata`)
      assert.equal(facebook.altaLista('102340567', enlace.valores.proveedor_id), true)
    }
  }
})

test('both registration methods still require a nonempty Facebook value before privileged access', async () => {
  process.env.AUTH_FACEBOOK = '1'
  for (const accion of ['registrarse', 'completarAltaFacebook']) {
    for (const entrada of ['', '  \t\n ']) {
      const registro = registroConRol()
      const formulario = formularioConRol('propietario')
      formulario.set('facebook', entrada)
      const resultado = await registro.acciones[accion](undefined, formulario)
      assert.match(resultado.error, /Escriba su perfil de Facebook/)
      assert.equal(registro.solicitudesAdmin(), 0)
      assert.equal(registro.escrituras.length, 0)
    }
  }
})

test('stored Facebook names and shared links count as complete and remain available for form prefill', async () => {
  for (const valor of ['María Solís', 'https://www.facebook.com/share/1Example/']) {
    const admin = {
      from: tabla => consulta(() => ({
        data: tabla === 'usuarios'
          ? { id: 42, auth_user_id: 'auth-facebook', identificacion: '102340567', rol: 'propietario' }
          : { proveedor_id: valor },
        error: null,
      }), tabla),
    }
    const alta = cargar('lib/facebook-alta.ts', {
      '@/lib/supabase/admin': { createAdmin: () => admin },
      '@/lib/supabase/server': {},
    })
    assert.equal(await alta.altaFacebookLista('auth-facebook'), true)
    const previa = await alta.previaAltaFacebook('auth-facebook', 'persona@example.com')
    assert.equal(previa.existe, true)
    assert.equal(previa.facebook, valor)
    assert.equal(previa.cedula, '102340567')
  }
})

test('accepted active Facebook administrators bypass ordinary document and Facebook-profile onboarding', async () => {
  process.env.AUTH_FACEBOOK = '1'
  const consultas = []
  const user = { id: 'facebook-admin', email: 'admin@example.com', app_metadata: { provider: 'facebook' } }
  const admin = {
    from: tabla => consulta(({ operacion, filtros }) => {
      consultas.push({ tabla, operacion, filtros })
      assert.equal(tabla, 'usuarios', 'an invited admin needs no public Facebook-profile lookup')
      assert.equal(operacion, 'select', 'the exemption must not provision or edit an account')
      return { data: { id: 42, auth_user_id: user.id, identificacion: null, rol: 'admin', activo: true }, error: null }
    }, tabla),
  }
  const alta = cargar('lib/facebook-alta.ts', {
    '@/lib/supabase/admin': { createAdmin: () => admin },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
  })
  assert.equal(await alta.altaFacebookLista(user.id), true)
  assert.equal(await alta.altaFacebookPendiente(), false, 'subsequent authenticated requests do not resume ordinary onboarding')
  assert.equal(await alta.vincularCuentaListaPorCorreo(user.id, user.email), true, 'OAuth callback recognizes the already-bound administrator')
  assert.equal(consultas.length, 3)
  assert.ok(consultas.every(({ filtros }) => filtros.some(([metodo, columna, valor]) => metodo === 'eq' && columna === 'auth_user_id' && valor === user.id)))
})

test('Facebook administrator exemption does not apply to inactive or ordinary incomplete accounts', async () => {
  for (const perfil of [
    { rol: 'admin', activo: false },
    { rol: 'propietario', activo: true },
    { rol: 'agencia', activo: true },
    { rol: 'inquilino', activo: true },
  ]) {
    const alta = cargar('lib/facebook-alta.ts', {
      '@/lib/supabase/admin': { createAdmin: () => ({
        from: tabla => consulta(() => ({
          data: tabla === 'usuarios' ? { id: 42, identificacion: null, ...perfil } : null,
          error: null,
        }), tabla),
      }) },
      '@/lib/supabase/server': {},
    })
    assert.equal(await alta.altaFacebookLista('auth-facebook'), false, `${perfil.rol}, active=${perfil.activo}`)
  }
})

test('legacy accounts with Facebook names or shared links can finish linking after provider sign-in', async () => {
  for (const valor of ['María Solís', 'https://www.facebook.com/share/1Example/']) {
    const escrituras = []
    const admin = {
      from: tabla => consulta(({ operacion, valores, filtros }) => {
        if (operacion === 'update') {
          escrituras.push({ valores, filtros })
          return { data: null, error: null }
        }
        if (tabla === 'usuarios') {
          return { data: filtros.some(filtro => filtro[1] === 'auth_user_id')
            ? null
            : { id: 42, auth_user_id: null, identificacion: '102340567', rol: 'propietario' }, error: null }
        }
        return { data: { proveedor_id: valor }, error: null }
      }, tabla),
    }
    const alta = cargar('lib/facebook-alta.ts', {
      '@/lib/supabase/admin': { createAdmin: () => admin },
      '@/lib/supabase/server': {},
    })
    assert.equal(await alta.vincularCuentaListaPorCorreo('auth-facebook', 'persona@example.com'), true)
    assert.equal(escrituras.length, 1)
    assert.equal(escrituras[0].valores.auth_user_id, 'auth-facebook')
    assert.equal(escrituras[0].valores.rol, undefined)
    assert.equal(escrituras[0].valores.identificacion, undefined)
    assert.deepEqual(escrituras[0].filtros, [['eq', 'id', 42], ['is', 'auth_user_id', null]])
  }
})

test('a new Facebook profile must explicitly choose owner or agency', async () => {
  process.env.AUTH_FACEBOOK = '1'
  const registro = registroConRol()
  const resultado = await registro.acciones.completarAltaFacebook(undefined, formularioConRol())
  assert.match(resultado.error, /propietario o agencia/)
  assert.equal(registro.escrituras.length, 0)
})

test('completing a legacy Facebook profile does not silently reassign its historical role', async () => {
  process.env.AUTH_FACEBOOK = '1'
  const registro = registroConRol({ existente: { id: 42, auth_user_id: 'auth-nueva', rol: 'inquilino' } })
  await assert.rejects(registro.acciones.completarAltaFacebook(undefined, formularioConRol()), error => error.ruta === '/registro/resena')
  const perfil = registro.escrituras.find(escritura => escritura.tabla === 'usuarios')
  assert.equal(perfil.operacion, 'update')
  assert.equal(perfil.valores.rol, undefined)
  const auth = registro.escrituras.find(escritura => escritura.tabla === 'auth')
  assert.equal(auth.valores.user_metadata.rol, 'inquilino')
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

test('email registration fails safely when Auth throttles confirmation delivery', async () => {
  const registro = registroConRol({ signupError: { status: 429 } })
  const resultado = await registro.acciones.registrarse(undefined, formularioConRol('propietario'))
  assert.match(resultado.error, /más tarde/)
  assert.equal(registro.escrituras.length, 1)
  assert.equal(registro.escrituras[0].operacion, 'signup')
})
