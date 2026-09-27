import assert from 'node:assert/strict'
import test from 'node:test'
import { destinoInterno, paginaSegura } from '../lib/util.ts'

test('preserves internal search destinations through sign-in', () => {
  const destino = '/fichas?q=Jos%C3%A9+Sol%C3%ADs&provincia=1&pagina=2'
  assert.equal(destinoInterno(destino), destino)
  assert.equal(destinoInterno('/resenas/nueva?personaId=12'), '/resenas/nueva?personaId=12')
})

test('rejects external redirects, backslashes and browser-normalized control characters', () => {
  for (const valor of ['https://example.com', '//example.com', '/\\example.com', '/\t/example.com', '/\n/example.com', '/\r/example.com', '/\0/example.com', '', null, 123]) {
    assert.equal(destinoInterno(valor), '/fichas')
  }
  assert.equal(destinoInterno('/' + 'x'.repeat(500)), '/fichas')
})

test('normalizes page numbers and rejects offsets that could stall pagination', () => {
  for (const valor of ['', 'no', '0', '-2', 'Infinity', '1e100', '9007199254740991']) {
    assert.equal(paginaSegura(valor), 1)
  }
  assert.equal(paginaSegura('2'), 2)
  assert.equal(paginaSegura('3.8'), 3)
})
