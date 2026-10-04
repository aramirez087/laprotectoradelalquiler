import assert from 'node:assert/strict'
import test from 'node:test'
import { retornoAuth } from '../lib/retorno-auth.ts'

test('a PKCE email callback landing at the homepage resumes the server verifier with only allowed parameters', () => {
  const result = retornoAuth('https://www.protectoradelalquiler.com/?code=private-code&sb_flow_id=flow-27&next=%2Frestablecer&siguiente=%2Fresenas%2Fnueva&utm_source=email&email=private@example.test')
  const target = new URL(result.ruta, 'https://www.protectoradelalquiler.com')
  assert.equal(target.pathname, '/auth/confirmar')
  assert.deepEqual(Object.fromEntries(target.searchParams), {
    code: 'private-code', sb_flow_id: 'flow-27', next: '/restablecer', siguiente: '/resenas/nueva',
  })
  assert.doesNotMatch(result.ruta, /utm_source|private@|email=/)
})

test('a hashed email token at the homepage retains its recovery or signup type', () => {
  for (const type of ['recovery', 'signup']) {
    const result = retornoAuth(`https://www.protectoradelalquiler.com/?token_hash=private-token&type=${type}`)
    const target = new URL(result.ruta, 'https://www.protectoradelalquiler.com')
    assert.equal(target.pathname, '/auth/confirmar')
    assert.equal(target.searchParams.get('token_hash'), 'private-token')
    assert.equal(target.searchParams.get('type'), type)
  }
})

test('legacy implicit recovery extracts credentials for setSession and directs to reset without tokens in the destination', () => {
  for (const path of ['/', '/restablecer', '/registro/resena']) {
    const result = retornoAuth(`https://www.protectoradelalquiler.com${path}#access_token=private-access&refresh_token=private-refresh&type=recovery&expires_in=3600`)
    assert.deepEqual(result, { accessToken: 'private-access', refreshToken: 'private-refresh', ruta: '/restablecer' })
    assert.doesNotMatch(result.ruta, /private-|access_token|refresh_token/)
  }
})

test('expired implicit links and partial recovery sessions offer another link without credential leaks', () => {
  for (const fragment of [
    'error=access_denied&error_description=private-token',
    'error_code=otp_expired&error_description=private@example.test',
    'type=recovery', 'type=recovery&access_token=private-access', 'type=recovery&refresh_token=private-refresh',
  ]) {
    const result = retornoAuth(`https://www.protectoradelalquiler.com/#${fragment}`)
    assert.deepEqual(result, { ruta: '/recuperar?error=enlace' })
    assert.doesNotMatch(result.ruta, /private-|private@|description/)
  }
})

test('normal browsing and callbacks already owned by auth routes are left untouched', () => {
  for (const href of [
    'https://www.protectoradelalquiler.com/',
    'https://www.protectoradelalquiler.com/#preguntas-frecuentes',
    'https://www.protectoradelalquiler.com/perfil#mis-resenas',
    'https://www.protectoradelalquiler.com/fichas?code=reference',
    'https://www.protectoradelalquiler.com/auth/confirmar?code=private-code',
    'https://www.protectoradelalquiler.com/auth/facebook/retorno#error=private-error',
    'https://www.protectoradelalquiler.com/#access_token=other-access&refresh_token=other-refresh&type=signup',
  ]) assert.equal(retornoAuth(href), null, href)
})
