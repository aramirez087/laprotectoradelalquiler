import assert from 'node:assert/strict'
import test from 'node:test'
import { crearAlmacenBorradores } from '../lib/borradores-admin.ts'

test('in-memory drafts retain the original snapshot separately for account and form type', () => {
  const store = crearAlmacenBorradores()
  const permisos = { version: 'original', rol: 'agencia', rolOriginal: 'propietario', activo: true }
  const datos = { version: 'original', nombre: 'Nombre sin guardar', original: 'Nombre anterior' }
  store.guardar('permisos:1', permisos)
  store.guardar('datos:1', datos)
  store.guardar('permisos:2', { ...permisos, rol: 'propietario' })
  assert.deepEqual(store.obtener('permisos:1'), permisos)
  assert.deepEqual(store.obtener('datos:1'), datos)
  assert.equal(store.obtener('permisos:2').rol, 'propietario')
})

test('saving or cancelling one draft leaves other edits intact; session cleanup removes all', () => {
  const store = crearAlmacenBorradores()
  store.guardar('datos:1', { nombre: 'Editado' })
  store.guardar('permisos:1', { activo: false })
  store.eliminar('datos:1')
  assert.equal(store.obtener('datos:1'), undefined)
  assert.deepEqual(store.obtener('permisos:1'), { activo: false })
  store.limpiar()
  assert.equal(store.obtener('permisos:1'), undefined)
})

test('draft memory is bounded and preserves the most recently edited accounts', () => {
  const store = crearAlmacenBorradores(2)
  store.guardar('datos:1', { nombre: 'Primera edición' })
  store.guardar('datos:2', { nombre: 'Segunda edición' })
  store.guardar('datos:1', { nombre: 'Edición más reciente' })
  store.guardar('datos:3', { nombre: 'Tercera edición' })
  assert.equal(store.obtener('datos:2'), undefined)
  assert.deepEqual(store.obtener('datos:1'), { nombre: 'Edición más reciente' })
  assert.deepEqual(store.obtener('datos:3'), { nombre: 'Tercera edición' })
  assert.throws(() => crearAlmacenBorradores(0), RangeError)
})
