import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { cargarTS } from './helpers/cedula-mocks.mjs'

const require = createRequire(import.meta.url)
const { PostgrestClient } = require('@supabase/postgrest-js')
const cedula = cargarTS('lib/cedula.ts')
const review = {
  id: 42, version: 3, estado: 'borrador', autor_id: 7,
  comentario: 'Pagó a tiempo y devolvió la propiedad en buen estado.', detalle_dano: null,
  autor: { identificacion: '1-0234-0567', activo: true },
  persona: { identificacion: '2-0345-0678', nombre: 'María', nombre2: null, apellido1: 'Solís', apellido2: 'Muñoz' },
}
const safe = { decision: 'segura', motivo: 'contenido_seguro', modelo: 'openai/gpt-oss-120b', politica: 'resenas-v1', categorias: [] }

function setup({ row = review, enabled = '1', key = 'synthetic-key', authorStatus = 'encontrada', tenantStatus = 'encontrada', tenantName = 'MARIA SOLIS MUNOZ', classification = safe, published = true, rpcError = false, failure = false, quota = true, reconciledState } = {}) {
  const lookups = [], classified = [], rpcs = [], reads = [], logs = [], claims = []
  const db = new PostgrestClient('https://example.test/rest/v1', { fetch: async (url, init) => {
    const path = new URL(url).pathname
    if (path.endsWith('/resenas')) {
      reads.push(new URL(url))
      return new Response(JSON.stringify(reads.length > 1 && reconciledState ? { estado: reconciledState } : row), { headers: { 'content-type': 'application/json' } })
    }
    if (path.endsWith('/consumir_cupo_moderacion_resena')) {
      claims.push(JSON.parse(init.body))
      return new Response(JSON.stringify(quota), { headers: { 'content-type': 'application/json' } })
    }
    assert.ok(path.endsWith('/resolver_moderacion_automatica_resena'))
    rpcs.push(JSON.parse(init.body))
    return new Response(JSON.stringify(rpcError ? { code: '503', message: 'Private data must not be logged' } : { publicada: published }), {
      status: rpcError ? 503 : 200, headers: { 'content-type': 'application/json' },
    })
  } })
  const api = cargarTS('lib/moderacion-automatica.ts', {
    'server-only': {}, '@/lib/cedula': cedula,
    '@/lib/supabase/admin': { createAdmin: () => { if (failure) throw new Error('private credential'); return db } },
    '@/lib/padron': { consultarCedula: async (id, persist) => {
      lookups.push({ id, persist })
      return { estado: id.startsWith('1') ? authorStatus : tenantStatus, persona: { nombreCompleto: tenantName } }
    } },
    '@/lib/moderacion-contenido': { moderarContenidoResena: async (...args) => { classified.push(args); return classification } },
    '@/lib/registro-error': { registrarError: event => logs.push(event) },
  }, { process: { env: { MODERACION_AUTOMATICA_ENABLED: enabled, GROQ_API_KEY: key } } })
  return { run: () => api.intentarAprobacionAutomatica({ id: 42, autorId: 7, version: 3 }), lookups, classified, rpcs, reads, logs, claims }
}

test('only the exact stored owner/version and two TSE proofs permit a publication RPC', async () => {
  const s = setup()
  assert.equal(await s.run(), true)
  assert.equal(s.reads[0].searchParams.get('autor_id'), 'eq.7')
  assert.deepEqual(s.lookups, [{ id: '102340567', persist: true }, { id: '203450678', persist: true }])
  assert.deepEqual(s.classified, [[review.comentario, null]])
  assert.deepEqual(s.claims, [{ p_id: 42, p_version: 3 }])
  assert.deepEqual(s.rpcs[0], {
    p_id: 42, p_version: 3, p_comentario: review.comentario, p_detalle_dano: null,
    p_autor_cedula: '102340567', p_persona_cedula: '203450678', p_resultado: safe,
  })
})

test('invalid, stale or missing IDs and mismatched tenant names skip AI and defer to humans', async () => {
  const cases = [
    [{ row: { ...review, autor: { identificacion: 'DIMEX123456', activo: true } } }, 'cedula_autor_no_verificada'],
    [{ row: { ...review, persona: { ...review.persona, identificacion: null } } }, 'cedula_inquilino_no_verificada'],
    [{ authorStatus: 'no_encontrada' }, 'cedula_autor_no_verificada'],
    [{ authorStatus: 'no_disponible' }, 'cedula_autor_no_verificada'],
    [{ tenantStatus: 'desactualizado' }, 'cedula_inquilino_no_verificada'],
    [{ tenantName: 'OTRA PERSONA' }, 'nombre_inquilino_no_coincide'],
    [{ row: { ...review, autor: { ...review.autor, activo: false } } }, 'autor_inactivo'],
  ]
  for (const [options, reason] of cases) {
    const s = setup({ ...options, published: false })
    assert.equal(await s.run(), false)
    assert.equal(s.classified.length, 0)
    assert.equal(s.claims.length, 0)
    assert.equal(s.rpcs[0].p_resultado.decision, 'revision')
    assert.equal(s.rpcs[0].p_resultado.motivo, reason)
  }
})

test('disabled moderation and changed or human-decided reviews never reach the provider or mutation', async () => {
  for (const options of [{ enabled: '0' }, { enabled: '' }, { row: null }, { row: { ...review, version: 4 } }, { row: { ...review, estado: 'oculta' } }]) {
    const s = setup(options)
    assert.equal(await s.run(), false)
    assert.equal(s.rpcs.length, 0)
    assert.equal(s.classified.length, 0)
  }
})

test('a human publication already committed is reflected without calling the provider', async () => {
  const s = setup({ row: { ...review, estado: 'publicada', version: 4 } })
  assert.equal(await s.run(), true)
  assert.equal(s.classified.length, 0)
  assert.equal(s.claims.length, 0)
})

test('an exhausted budget or duplicate claim is audited for human review without provider I/O', async () => {
  const s = setup({ quota: false, published: false })
  assert.equal(await s.run(), false)
  assert.equal(s.classified.length, 0)
  assert.equal(s.rpcs[0].p_resultado.motivo, 'moderacion_limite')
})

test('an absent provider key defers without consuming the paid-call budget', async () => {
  const s = setup({ key: '', published: false })
  assert.equal(await s.run(), false)
  assert.equal(s.classified.length, 0)
  assert.equal(s.claims.length, 0)
  assert.equal(s.rpcs[0].p_resultado.motivo, 'moderacion_no_configurada')
})

test('publication survives a lost acknowledgement by reconciling committed state', async () => {
  const s = setup({ rpcError: true, reconciledState: 'publicada' })
  assert.equal(await s.run(), true)
  assert.equal(s.reads.length, 2)
  assert.deepEqual(s.logs, ['automatic_review_moderation_error'])
})

test('provider deferrals preserve their audit and a concurrent database refusal stays pending', async () => {
  for (const classification of [{ ...safe, decision: 'revision', motivo: 'contenido_sensible', categorias: ['sexual_explicito'] }, { ...safe, decision: 'revision', motivo: 'moderacion_no_disponible', categorias: [] }]) {
    const s = setup({ classification, published: false })
    assert.equal(await s.run(), false)
    assert.deepEqual(s.rpcs[0].p_resultado, classification)
  }
  assert.equal(await setup({ published: false }).run(), false)
})

test('service and audit failures do not fail the saved submission or log content', async () => {
  for (const options of [{ failure: true }, { rpcError: true }]) {
    const s = setup(options)
    assert.equal(await s.run(), false)
    assert.deepEqual(s.logs, ['automatic_review_moderation_error'])
  }
})
