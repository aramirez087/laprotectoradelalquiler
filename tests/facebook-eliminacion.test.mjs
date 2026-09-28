import assert from 'node:assert/strict'
import test from 'node:test'
import {
  codigoEliminacion,
  codigoEliminacionValido,
  correoEliminado,
  firmarSolicitudFacebook,
  leerSolicitudFirmada,
} from '../lib/facebook-eliminacion.ts'

test('accepts a Facebook signed request signed with the app secret', () => {
  const firmada = firmarSolicitudFacebook('100012345', 'secreto-de-prueba')
  assert.deepEqual(leerSolicitudFirmada(firmada, 'secreto-de-prueba'), { user_id: '100012345' })
  assert.equal(leerSolicitudFirmada(firmada, 'otro-secreto'), null)
  assert.equal(leerSolicitudFirmada('no-es-una-firma', 'secreto-de-prueba'), null)
  assert.equal(leerSolicitudFirmada('', 'secreto-de-prueba'), null)
})

test('rejects a signed request whose payload was edited after signing', () => {
  const firmada = firmarSolicitudFacebook('100012345', 'secreto-de-prueba')
  const [firma] = firmada.split('.')
  const payload = Buffer.from(JSON.stringify({ algorithm: 'HMAC-SHA256', user_id: '999' })).toString('base64url')
  assert.equal(leerSolicitudFirmada(`${firma}.${payload}`, 'secreto-de-prueba'), null)
})

test('confirmation codes are url-safe and the tombstone email cannot be a real inbox', () => {
  const codigo = codigoEliminacion()
  assert.equal(codigoEliminacionValido(codigo), true)
  assert.equal(codigoEliminacionValido('corto'), false)
  assert.equal(codigoEliminacionValido('../etc'), false)
  assert.equal(correoEliminado(codigo), `eliminada.${codigo}@cuentas.invalid`)
})
