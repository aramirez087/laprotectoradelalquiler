import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { plantillaCorreo } from '../lib/plantilla-correo.ts'

test('email content escapes user text and preserves secure action query parameters', () => {
  const html = plantillaCorreo({ titulo: '<script>alert(1)</script>', resumen: 'Resumen', parrafos: ['Hola, <img src=x onerror=alert(1)>'], accion: { texto: 'Aceptar', url: 'https://www.protectoradelalquiler.com/invitacion/admin?id=1&token=private-token' } })
  assert.doesNotMatch(html, /<script|<img/)
  assert.match(html, /&lt;img/)
  assert.match(html, /id=1&amp;token=private-token/)
  assert.match(html, /lang="es"/)
  assert.match(html, /role="presentation"/)
  assert.doesNotMatch(html, /<script|<link|<img|@import/)
})
test('email actions reject unsafe links and preserve Supabase confirmation placeholders', () => {
  const base = { titulo: 'Título', resumen: '', parrafos: [] }
  for (const url of ['javascript:alert(1)', 'http://example.com', 'https://user:secret@example.com']) assert.throws(() => plantillaCorreo({ ...base, accion: { texto: 'Abrir', url } }))
  assert.match(plantillaCorreo({ ...base, accion: { texto: 'Abrir', url: '{{ .ConfirmationURL }}' } }), /href="{{ .ConfirmationURL }}"/)
})
test('all saved Auth templates keep required token variables without localhost or private metadata', () => {
  const config = JSON.parse(readFileSync('emails/supabase/config.json', 'utf8'))
  for (const key of ['confirmation', 'recovery', 'invite', 'magic_link', 'email_change', 'reauthentication']) {
    const html = config[`mailer_templates_${key}_content`]
    assert.match(html, key === 'reauthentication' ? /{{ \.Token }}/ : /href="{{ \.ConfirmationURL }}"/)
    assert.doesNotMatch(html, /localhost|\.Data|\.Email|\.NewEmail/)
    assert.match(config[`mailer_subjects_${key}`], /La Protectora del Alquiler/)
  }
})
