import assert from 'node:assert/strict'
import test from 'node:test'
import {
  altaLista,
  authFacebookHabilitado,
  cuentaCreadaConFacebook,
  destinoTrasEntrarConFacebook,
  esErrorDeCorreoOcupado,
  esRutaDeAltaFacebook,
  mensajeErrorFacebook,
  nombreDesdeFacebook,
  rutaAltaFacebook,
  rutaEntrarConFacebook,
  rutaTrasFalloFacebook,
  tieneIdentidadFacebook,
} from '../lib/facebook-auth.ts'

test('Facebook sign-in stays off unless AUTH_FACEBOOK is exactly 1', () => {
  assert.equal(authFacebookHabilitado(''), false)
  assert.equal(authFacebookHabilitado('true'), false)
  assert.equal(authFacebookHabilitado('0'), false)
  assert.equal(authFacebookHabilitado('1'), true)
})

test('a Facebook-created account needs a valid cédula and any nonempty Facebook value', () => {
  assert.equal(cuentaCreadaConFacebook({ app_metadata: { provider: 'facebook' } }), true)
  assert.equal(cuentaCreadaConFacebook({ app_metadata: { provider: 'email' } }), false)
  assert.equal(cuentaCreadaConFacebook(null), false)
  for (const facebook of [
    'https://www.facebook.com/maria.solis',
    '@maria.solis',
    'María Solís',
    'https://www.facebook.com/share/1Example/',
    'https://facebook.com',
  ]) {
    assert.equal(altaLista('1-0234-0567', facebook), true, facebook)
  }
  assert.equal(altaLista(null, 'https://www.facebook.com/maria.solis'), false)
  assert.equal(altaLista('123', 'María Solís'), false)
  for (const facebook of [null, undefined, '', '  \t\n ']) {
    assert.equal(altaLista('1-0234-0567', facebook), false)
  }
})

test('an email account that later links Facebook is not sent through sign-up again', () => {
  const vinculada = {
    app_metadata: { provider: 'email', providers: ['email', 'facebook'] },
    identities: [{ provider: 'email' }, { provider: 'facebook' }],
  }
  assert.equal(cuentaCreadaConFacebook(vinculada), false)
  assert.equal(tieneIdentidadFacebook(vinculada), true)
  assert.equal(tieneIdentidadFacebook({ app_metadata: { provider: 'email', providers: ['email'] } }), false)
})

test('after Facebook returns, an incomplete account goes to the hidden sign-up step', () => {
  assert.equal(destinoTrasEntrarConFacebook('/fichas', false), rutaAltaFacebook('/fichas'))
  assert.equal(destinoTrasEntrarConFacebook('/fichas?q=Jose', true), '/fichas?q=Jose')
  assert.equal(rutaEntrarConFacebook('/fichas?q=Jose'), '/auth/facebook?siguiente=%2Ffichas%3Fq%3DJose')
  assert.equal(esRutaDeAltaFacebook('/registro/facebook'), true)
  assert.equal(esRutaDeAltaFacebook('/auth/facebook/retorno'), true)
  assert.equal(esRutaDeAltaFacebook('/auth/confirmar'), true)
  assert.equal(esRutaDeAltaFacebook('/login'), false)
})

test('Facebook failures stay off the password-reset screen and hide while the flag is off', () => {
  assert.equal(esErrorDeCorreoOcupado('User already registered'), true)
  assert.equal(
    rutaTrasFalloFacebook('User already registered', 'entrar', '/fichas'),
    '/login?error=facebook-correo&siguiente=%2Ffichas',
  )
  assert.equal(rutaTrasFalloFacebook('access_denied', 'entrar', '/fichas'), '/login?error=facebook&siguiente=%2Ffichas')
  assert.equal(rutaTrasFalloFacebook('access_denied', 'vincular', '/perfil'), '/perfil?error=facebook')
  assert.equal(mensajeErrorFacebook('facebook', false), null)
  assert.match(mensajeErrorFacebook('facebook-correo', true) ?? '', /clave/)
  assert.equal(mensajeErrorFacebook('otro', true), null)
})

test('uses the Facebook name only when it is long enough to be a full name', () => {
  assert.equal(nombreDesdeFacebook({ full_name: 'María Solís' }), 'María Solís')
  assert.equal(nombreDesdeFacebook({ name: 'Ana' }), 'Ana')
  assert.equal(nombreDesdeFacebook({ name: 'Al' }), '')
  assert.equal(nombreDesdeFacebook({ nombre: '  Luis Pérez  ' }), 'Luis Pérez')
  assert.equal(nombreDesdeFacebook(null), '')
})
