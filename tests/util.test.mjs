import assert from 'node:assert/strict'
import test from 'node:test'
import { destinoInterno, paginaSegura, mascararCedula, normalizarPerfilFacebook, normalizarCedula, esCedulaValida, identidadAutorResena, fechaCorta } from '../lib/util.ts'

test('review timestamps change date at midnight in Costa Rica, not UTC', () => {
  for (const iso of [
    '2026-09-30T00:00:00Z',
    '2026-09-30T05:59:59.999+00:00',
    '2026-09-29T23:59:59.999-06:00',
  ]) assert.equal(fechaCorta(iso), '29 sept 2026', iso)
  assert.equal(fechaCorta('2026-09-30T06:00:00Z'), '30 sept 2026')
  assert.equal(fechaCorta('2026-09-30T08:00:00+02:00'), '30 sept 2026')
  assert.equal(fechaCorta('2027-01-01T05:59:59Z'), '31 dic 2026')
})

test('rental dates without a time keep their calendar date', () => {
  assert.equal(fechaCorta('2026-09-29'), '29 sept 2026')
  assert.equal(fechaCorta('2026-01-01'), '1 ene 2026')
})

test('missing or invalid dates do not render a date', () => {
  for (const valor of [null, undefined, '', 'invalid', '2026-09-29Tinvalid']) {
    assert.equal(fechaCorta(valor), null)
  }
})

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

test('an anonymous review hides the account except to administration', () => {
  const publico = identidadAutorResena({
    anonima: true,
    esAdmin: false,
    nombre: 'María Solís',
    rol: 'propietario',
  })
  assert.deepEqual(publico, { nombre: 'Anónimo', rol: null, marcaAnonima: false })

  const admin = identidadAutorResena({
    anonima: true,
    esAdmin: true,
    nombre: 'María Solís',
    rol: 'propietario',
  })
  assert.deepEqual(admin, { nombre: 'María Solís', rol: 'propietario', marcaAnonima: true })

  const firmada = identidadAutorResena({
    anonima: false,
    esAdmin: false,
    nombre: 'María Solís',
    rol: 'inquilino',
  })
  assert.equal(firmada.nombre, 'María Solís')
  assert.equal(firmada.marcaAnonima, false)

  const importada = identidadAutorResena({ anonima: false, esAdmin: false, nombre: '  ', rol: null })
  assert.equal(importada.nombre, 'Reseña importada')
})

test('search-card documents never reveal a complete identifier, including short or missing values', () => {
  for (const documento of [null, undefined, '', '123', '1234']) {
    assert.equal(mascararCedula(documento), '••••')
  }
  assert.equal(mascararCedula('1-0234-0567'), '102····7')
  assert.equal(mascararCedula('123456789012'), '123····2')
})
