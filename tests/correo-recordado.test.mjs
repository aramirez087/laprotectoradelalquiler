import assert from 'node:assert/strict'
import test from 'node:test'
import { correoRecordado } from '../lib/correo-recordado.ts'

test('keeps a normal email and rejects anything that is not one', () => {
  assert.equal(correoRecordado('  Ana@Correo.com '), 'ana@correo.com')
  assert.equal(correoRecordado('no-es-correo'), '')
  assert.equal(correoRecordado('a@b'), '')
  assert.equal(correoRecordado(''), '')
  assert.equal(correoRecordado(null), '')
})
