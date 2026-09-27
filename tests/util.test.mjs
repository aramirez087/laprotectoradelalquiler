import assert from 'node:assert/strict'
import test from 'node:test'
import { destinoInterno, paginaSegura, mascararCedula, normalizarPerfilFacebook, normalizarCedula, esCedulaValida } from '../lib/util.ts'

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


test('accepts a cédula with or without hyphens and rejects documents outside 6 to 12 digits', () => {
  assert.equal(normalizarCedula(' 1-0234-0567 '), '1-0234-0567')
  assert.equal(esCedulaValida('1-0234-0567'), true)
  assert.equal(esCedulaValida('102340567'), true)
  assert.equal(esCedulaValida('12345'), false)
  assert.equal(esCedulaValida('1234567890123'), false)
})

test('turns a Facebook profile link or username into a canonical profile URL', () => {
  assert.equal(normalizarPerfilFacebook('maria.solis'), 'https://www.facebook.com/maria.solis')
  assert.equal(
    normalizarPerfilFacebook('https://m.facebook.com/maria.solis?fbclid=abc'),
    'https://www.facebook.com/maria.solis',
  )
  assert.equal(
    normalizarPerfilFacebook('facebook.com/profile.php?id=100012345'),
    'https://www.facebook.com/profile.php?id=100012345',
  )
  assert.equal(normalizarPerfilFacebook('https://www.facebook.com/groups/299591643850909'), null)
  assert.equal(normalizarPerfilFacebook('https://example.com/maria.solis'), null)
  assert.equal(normalizarPerfilFacebook('https://facebook.com'), null)
  assert.equal(normalizarPerfilFacebook(''), null)
})

test('search-card documents never reveal a complete identifier, including short or missing values', () => {
  for (const documento of [null, undefined, '', '123', '1234']) {
    assert.equal(mascararCedula(documento), '••••')
  }
  assert.equal(mascararCedula('1-0234-0567'), '102····7')
  assert.equal(mascararCedula('123456789012'), '123····2')
})
