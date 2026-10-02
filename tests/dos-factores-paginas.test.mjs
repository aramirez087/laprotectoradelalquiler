import assert from 'node:assert/strict'
import { AsyncLocalStorage } from 'node:async_hooks'
import { createRequire } from 'node:module'
import test from 'node:test'
import { cargarTS } from './helpers/cedula-mocks.mjs'

// Next's standalone matcher utility needs the same runtime primitive as Next.
globalThis.AsyncLocalStorage ??= AsyncLocalStorage
const require = createRequire(import.meta.url)
const { unstable_doesMiddlewareMatch } = require('next/experimental/testing/server')
const util = cargarTS('lib/util.ts')
const { config } = cargarTS('proxy.ts', {
  '@/lib/util': util, '@/lib/facebook-alta': {}, '@/lib/facebook-auth': {},
  '@/lib/supabase/server': {}, '@/lib/supabase/proxy': {}, '@/lib/seo': {},
})

function page({ aal = 'aal1', enrolled = true, claimsError = false } = {}) {
  const reads = []
  const user = { id: 'fixture', email: 'fixture@example.test', factors: enrolled ? [{ id: 'factor', status: 'verified', factor_type: 'totp' }] : [] }
  const component = cargarTS('app/registro/facebook/page.tsx', {
    '@/lib/util': util,
    'next/navigation': { redirect: path => { throw Object.assign(new Error('redirect'), { path }) } },
    '@/components/marco-acceso': { MarcoAcceso: () => null },
    '@/components/registro-facebook-form': { RegistroFacebookForm: () => null },
    '@/lib/actions/auth': {},
    '@/lib/facebook-auth': { authFacebookHabilitado: () => true, cuentaCreadaConFacebook: () => true, esRutaDeAltaFacebook: () => false, nombreDesdeFacebook: () => 'Fixture' },
    '@/lib/facebook-alta': {
      altaFacebookLista: async () => { reads.push('status'); return false },
      previaAltaFacebook: async () => { reads.push('profile'); return { existe: true, cedula: 'saved-id', facebook: 'saved-facebook' } },
    },
    '@/lib/supabase/server': { sinSupabase: () => false, createClient: async () => ({ auth: {
      getUser: async () => ({ data: { user } }),
      getClaims: async () => ({ data: { claims: { sub: user.id, aal } }, error: claimsError ? new Error('Unavailable') : null }),
    } }) },
  })
  return { run: () => component.default({ searchParams: Promise.resolve({}) }), reads }
}

test('Facebook completion enforces MFA when prefetch requests bypass the proxy', async () => {
  for (const headers of [{ 'next-router-prefetch': '1' }, { purpose: 'prefetch' }]) {
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: '/registro/facebook', headers }), false)
    const h = page()
    await assert.rejects(h.run(), error => error.path === '/login/verificar?siguiente=%2Fregistro%2Ffacebook')
    assert.deepEqual(h.reads, [], 'neither service-client read may run for a partial session')
  }
})

test('Facebook completion keeps optional MFA and verified sessions working, failing closed on claims errors', async () => {
  for (const options of [{ enrolled: false }, { aal: 'aal2' }]) {
    const h = page(options)
    assert.ok(JSON.stringify(await h.run()).includes('saved-id'))
    assert.deepEqual(h.reads, ['status', 'profile'])
  }
  const failed = page({ claimsError: true })
  await assert.rejects(failed.run(), /sesión/)
  assert.deepEqual(failed.reads, [])
})
