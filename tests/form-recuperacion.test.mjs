import assert from 'node:assert/strict'
import test from 'node:test'
import { cargarTS } from './helpers/cedula-mocks.mjs'

function formulario({ accion, estado, invalid = null } = {}) {
  const resultados = [], reportes = [], enfocados = []
  const alerta = { closest: () => null, focus: () => enfocados.push('alerta') }
  const status = { closest: () => null, focus: () => enfocados.push('borrador') }
  const form = { querySelector(selector) {
    if (selector === '[aria-invalid="true"]') return invalid
    if (selector === '[role="alert"]') return alerta
    if (selector === '[role="alert"], [role="status"]') return status
    return null
  } }
  const api = cargarTS('components/use-form-action.ts', {
    react: {
      useActionState: fn => [estado, fn, false],
      useRef: () => ({ current: form }),
      useEffect: fn => fn(),
    },
    'next/navigation': { unstable_rethrow(error) { if (error.digest === 'NEXT_REDIRECT') throw error } },
    '@/lib/error-cliente': { registrarErrorCliente: error => reportes.push(error) },
  })
  const hook = api.useFormAction(accion, { onResultado: result => resultados.push(result) })
  return { run: hook.formProps.action, resultados, reportes, enfocados }
}

test('network errors notify recovery callbacks so paused drafts can resume', async () => {
  const error = new TypeError('Network failed')
  const f = formulario({ accion: async () => { throw error } })
  const result = await f.run(undefined, new FormData())
  assert.match(result.error, /Sus datos se conservan/)
  assert.deepEqual(f.resultados, [result])
  assert.deepEqual(f.reportes, [error])
})

test('successful redirects do not resume drafts or report a false failure', async () => {
  const error = Object.assign(new Error('Redirect'), { digest: 'NEXT_REDIRECT' })
  const f = formulario({ accion: async () => { throw error } })
  await assert.rejects(f.run(undefined, new FormData()), e => e === error)
  assert.deepEqual(f.resultados, [])
  assert.deepEqual(f.reportes, [])
})

test('submission errors receive focus ahead of an earlier draft status', () => {
  const f = formulario({ estado: { error: 'No se pudo guardar.' } })
  assert.deepEqual(f.enfocados, ['alerta'])
})

test('field validation retains priority over a general error', () => {
  let focused = false
  const f = formulario({ estado: { error: 'Revise los campos.' }, invalid: {
    closest: () => null, focus: () => { focused = true },
  } })
  assert.equal(focused, true)
  assert.deepEqual(f.enfocados, [])
})

function consulta(fetch) {
  const timers = new Map(), states = [], found = []
  let cleanup, count = 0
  const { useConsultaCedula: invokeWithMockedReact } = cargarTS('components/use-consulta-cedula.ts', {
    react: { useState: () => [null, s => states.push(s)], useEffect: fn => { cleanup = fn() } },
    '@/lib/cedula': cargarTS('lib/cedula.ts'),
  }, {
    fetch, AbortController, AbortSignal: undefined,
    setTimeout: (fn, ms) => { const id = ++count; timers.set(id, { fn, ms }); return id },
    clearTimeout: id => timers.delete(id),
  })
  invokeWithMockedReact('102340567', p => found.push(p))
  function fire(ms) {
    const [id, timer] = [...timers].find(([, t]) => t.ms === ms)
    timers.delete(id)
    return timer.fn()
  }
  return { states, found, timers, fire, cleanup: () => cleanup() }
}

const match = { estado: 'encontrada', fechaPadron: '2026-08-31', persona: { identificacion: '102340567' } }

test('TSE lookup works without AbortSignal.any or AbortSignal.timeout', async () => {
  let signal
  const c = consulta(async (_url, init) => { signal = init.signal; return Response.json(match) })
  await c.fire(450)
  assert.equal(signal.aborted, false)
  assert.deepEqual(c.found, [match.persona])
  assert.equal(c.states.at(-1).resultado.estado, 'encontrada')
  assert.equal(c.timers.size, 0)
})

test('TSE timeout releases manual entry and clears its deadline', async () => {
  const c = consulta((_url, init) => new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true })
  }))
  const pending = c.fire(450)
  c.fire(15000)
  await pending
  assert.equal(c.states.at(-1).resultado.estado, 'no_disponible')
  assert.equal(c.found.length, 0)
  assert.equal(c.timers.size, 0)
})

test('changing the document cancels the old lookup without showing a stale error', async () => {
  const c = consulta((_url, init) => new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true })
  }))
  const pending = c.fire(450)
  c.cleanup()
  await pending
  assert.equal(c.states.length, 1)
  assert.equal(c.found.length, 0)
  assert.equal(c.timers.size, 0)
})
