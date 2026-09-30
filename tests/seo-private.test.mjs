import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const { NextRequest } = require('next/server')
const { unstable_doesMiddlewareMatch: doesProxyMatch } = require('next/experimental/testing/server')
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
    crypto,
    Buffer,
    Headers,
    URL,
    URLSearchParams,
  }, { filename: archivo.pathname })
  return modulo.exports
}

function proxyCon({ configurado = true, indexable = true, user = { id: 'cuenta' }, facebook = false, error = false } = {}) {
  return cargar('proxy.ts', {
    '@/lib/seo': { esEntornoIndexable: () => indexable },
    '@/lib/facebook-alta': { altaFacebookLista: async () => false },
    '@/lib/facebook-auth': {
      authFacebookHabilitado: () => facebook,
      cuentaCreadaConFacebook: () => facebook,
      esRutaDeAltaFacebook: path => path.startsWith('/registro/facebook'),
    },
    '@/lib/supabase/server': {
      sinSupabase: () => !configurado,
      createClient: async () => ({ auth: {
        getUser: async () => {
          if (error) throw new Error('Servicio no disponible')
          return { data: { user } }
        },
      } }),
    },
    '@/lib/util': { destinoInterno: path => path ?? '/' },
  })
}

const rutasPrivadas = [
  '/login', '/registro', '/registro/resena', '/registro/facebook',
  '/recuperar', '/restablecer', '/invitacion/admin',
  '/fichas?q=102340567', '/fichas/12', '/resenas/nueva?personaId=12', '/perfil',
  '/admin', '/admin/revision', '/admin/resenas', '/admin/usuarios/7',
  '/admin/reportes/csv?desde=2026-09-01', '/ux-resenas-preview',
  '/auth/confirmar?token_hash=secreto', '/auth/facebook', '/auth/facebook/retorno',
  '/auth/facebook/datos', '/auth/facebook/eliminacion', '/auth/facebook/eliminacion/estado',
]

function comprobarExclusion(response) {
  const directivas = new Set(response.headers.get('x-robots-tag')?.split(',').map(valor => valor.trim()))
  for (const directiva of ['noindex', 'nofollow', 'nosnippet', 'noimageindex']) {
    assert.ok(directivas.has(directiva), `Falta ${directiva}`)
  }
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.ok(response.headers.get('content-security-policy'))
}

test('private pages, auth callbacks, previews and CSV exports are intercepted and excluded from search', async () => {
  for (const configurado of [true, false]) {
    const { proxy, config } = proxyCon({ configurado })
    for (const path of rutasPrivadas) {
      assert.equal(doesProxyMatch({ config, nextConfig: {}, url: path }), true, path)
      const response = await proxy(new NextRequest(new URL(path, 'https://example.test')))
      comprobarExclusion(response)
    }
  }
})

test('private login, unavailable-auth and incomplete-Facebook redirects retain robot exclusion', async () => {
  for (const opciones of [{ user: null }, { error: true }, { facebook: true }]) {
    const { proxy } = proxyCon(opciones)
    const response = await proxy(new NextRequest('https://example.test/fichas/12?q=Ana'))
    assert.equal(response.status, 307)
    assert.ok(response.headers.get('location'))
    comprobarExclusion(response)
  }
})

test('production public pages and crawl files remain indexable while preview responses are excluded', async () => {
  for (const path of ['/', '/como-funciona', '/privacidad', '/robots.txt', '/sitemap.xml']) {
    const request = new NextRequest(new URL(path, 'https://example.test'))
    const production = await proxyCon().proxy(request)
    assert.equal(production.headers.get('x-robots-tag'), null, path)
    const preview = await proxyCon({ indexable: false }).proxy(request)
    comprobarExclusion(preview)
  }
})

test('ficha metadata never loads or exposes tenant data, even for a permitted account', async () => {
  let consultas = 0
  const consultaPrivada = () => {
    consultas += 1
    throw new Error('Los metadatos no deben consultar datos privados')
  }
  const pagina = cargar('app/fichas/[id]/page.tsx', {
    '@/lib/correo-resenas': {},
    '@/components/admin-formularios': {},
    '@/components/espera-aprobacion': {},
    '@/components/aviso-configuracion': {},
    '@/components/avatar': {},
    '@/components/tarjeta-resena': {},
    '@/components/estado-vacio': {},
    '@/lib/supabase/server': { sinSupabase: () => false },
    '@/lib/util': { nombreCompleto: consultaPrivada },
    '@/lib/dal': {
      obtenerUsuario: consultaPrivada,
      puedeConsultar: consultaPrivada,
      obtenerFicha: consultaPrivada,
      requireUsuario: consultaPrivada,
      resenasPrivadasVisibles: consultaPrivada,
    },
  })
  const metadata = pagina.metadata ?? await pagina.generateMetadata({
    params: Promise.resolve({ id: '12' }),
    searchParams: Promise.resolve({ q: 'Ana Vargas', identificacion: '102340567' }),
  })
  assert.equal(consultas, 0)
  assert.match(metadata.title, /Ficha privada/)
  assert.equal(metadata.robots.index, false)
  assert.equal(metadata.robots.follow, false)
  assert.equal(metadata.robots.nosnippet, true)
  assert.equal(metadata.openGraph, null)
  assert.equal(metadata.twitter, null)
  assert.doesNotMatch(JSON.stringify(metadata), /Ana Vargas|102340567/)
})
