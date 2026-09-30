import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const root = new URL('../', import.meta.url)

function cargar(ruta, mocks = {}) {
  const archivo = new URL(ruta, root)
  const codigo = ts.transpileModule(readFileSync(archivo, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText
  const modulo = { exports: {} }
  vm.runInNewContext(codigo, {
    module: modulo,
    exports: modulo.exports,
    require: nombre => nombre in mocks ? mocks[nombre] : require(nombre),
    URLSearchParams,
  }, { filename: archivo.pathname })
  return modulo.exports
}

function redirigir(ruta) {
  const error = new Error('redirect')
  error.ruta = ruta
  throw error
}

const util = cargar('lib/util.ts')
const usuario = { id: 7, nombre: 'María Solís', rol: 'propietario', activo: true }
const ficha = {
  id: 12,
  identificacion: '102340567',
  nombre: 'Ana',
  nombre2: null,
  apellido1: 'Vargas',
  apellido2: null,
  resenas: [],
}

function pagina({
  sesion = usuario,
  consulta = true,
  propias = [{ persona_id: 99 }],
  persona = ficha,
  errorFicha = false,
  errorPropias = false,
  privadas = [],
} = {}) {
  const solicitudes = { destinos: [], fichas: [], resenas: [], formulario: null }
  const Page = cargar('app/resenas/nueva/page.tsx', {
    'next/link': ({ href, children, ...props }) => createElement('a', { href, ...props }, children),
    'next/navigation': { redirect: redirigir },
    '@/lib/actions/resenas': { crearResenaAction: () => {} },
    '@/lib/supabase/server': { sinSupabase: () => false },
    '@/lib/util': util,
    '@/lib/acceso-consulta': { REGLAS_CONSULTA: 'Reglas de consulta.' },
    '@/components/aviso-configuracion': { AvisoConfiguracion: () => null },
    '@/components/form-resena': { FormResena: props => {
      solicitudes.formulario = props
      return createElement('form', { 'aria-label': 'Compartir una experiencia' })
    } },
    '@/lib/dal': {
      requireUsuario: async destino => { solicitudes.destinos.push(destino); return sesion },
      puedeConsultar: async () => consulta,
      listarResenasDe: async id => {
        solicitudes.resenas.push(id)
        if (errorPropias) throw new Error('Unavailable')
        return propias
      },
      obtenerFicha: async id => {
        solicitudes.fichas.push(id)
        if (errorFicha) throw new Error('Unavailable')
        return persona
      },
      resenasPrivadasVisibles: async () => privadas,
    },
  }).default
  return {
    solicitudes,
    render: async (params = {}) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) })),
  }
}

test('an existing review opens the profile instead of inviting a duplicate, including expired consultation', async () => {
  for (const estado of ['publicada', 'borrador', 'oculta']) {
    for (const consulta of [true, false]) {
      const p = pagina({ propias: [{ persona_id: 12, estado }], consulta })
      await assert.rejects(p.render({ personaId: '12' }), error => error.ruta === '/perfil#mis-resenas')
      assert.deepEqual(p.solicitudes.fichas, [])
      assert.deepEqual(p.solicitudes.resenas, [usuario.id])
    }
  }
})

test('administrators also resume their existing review before loading a selected ficha', async () => {
  const p = pagina({ sesion: { ...usuario, rol: 'admin' }, propias: [{ persona_id: 12 }] })
  await assert.rejects(p.render({ personaId: '12' }), error => error.ruta === '/perfil#mis-resenas')
  assert.deepEqual(p.solicitudes.fichas, [])
})

test('selected ficha ownership still prevents duplicates after the initial own-review lookup fails', async () => {
  for (const rol of ['propietario', 'admin']) {
    for (const estado of ['publicada', 'borrador', 'oculta']) {
      const propia = { id: 42, estado, propia: true }
      const p = pagina({
        sesion: { ...usuario, rol },
        errorPropias: true,
        persona: { ...ficha, resenas: estado === 'publicada' ? [propia] : [] },
        privadas: estado === 'publicada' ? [] : [propia],
      })
      await assert.rejects(p.render({ personaId: '12' }), error => error.ruta === '/perfil#mis-resenas')
      assert.deepEqual(p.solicitudes.fichas, [ficha.id])
      assert.equal(p.solicitudes.formulario, null)
    }
  }
})

test('the selected form and authentication destination preserve encoded search and page context', async () => {
  const p = pagina()
  const html = await p.render({ personaId: '12', q: [' Ana & Solís ', 'Otro'], pagina: ['2', '9'] })
  assert.equal(p.solicitudes.destinos[0], '/resenas/nueva?personaId=12&q=Ana+%26+Sol%C3%ADs&pagina=2')
  assert.match(html, /href="\/fichas\/12\?q=Ana\+%26\+Sol%C3%ADs&amp;pagina=2"/)
  assert.equal(p.solicitudes.formulario.personaInicial.personaId, ficha.id)
  assert.equal(p.solicitudes.formulario.personaInicial.identificacion, util.mascararCedula(ficha.identificacion))
  assert.equal(p.solicitudes.formulario.enRevision, true)
  assert.deepEqual(p.solicitudes.resenas, [usuario.id])
})

test('a failed selected ficha keeps the selection and search for retry without rendering an unlocked form', async () => {
  const p = pagina({ errorFicha: true })
  const html = await p.render({ personaId: '12', q: 'Vargas', pagina: '3' })
  assert.match(html, /No pudimos cargar la ficha/)
  assert.match(html, /href="\/resenas\/nueva\?personaId=12&amp;q=Vargas&amp;pagina=3"/)
  assert.match(html, /href="\/fichas\?q=Vargas&amp;pagina=3"/)
  assert.doesNotMatch(html, /<form/)
  assert.equal(p.solicitudes.formulario, null)
})

test('a missing selected ficha gives a distinct result-recovery state without a futile retry or form', async () => {
  const p = pagina({ persona: null })
  const html = await p.render({ personaId: '12', q: 'Vargas', pagina: '3' })
  assert.match(html, /No encontramos esta ficha/)
  assert.match(html, /href="\/fichas\?q=Vargas&amp;pagina=3"/)
  assert.doesNotMatch(html, /Intentar de nuevo|<form|href="\/fichas\/12/)
})

test('without consultation a selected ficha is never loaded or revealed and the user can recover access or write another review', async () => {
  const p = pagina({ consulta: false })
  const html = await p.render({ personaId: '12' })
  assert.match(html, /No puede consultar esta ficha/)
  assert.match(html, /href="\/perfil#acceso-consultas"/)
  assert.match(html, /href="\/resenas\/nueva"/)
  assert.doesNotMatch(html, /Ana|Vargas|102340567|<form/)
  assert.deepEqual(p.solicitudes.fichas, [])
})

test('expired consultation still permits a generic new review and returns to the profile', async () => {
  const p = pagina({ consulta: false })
  const html = await p.render()
  assert.match(html, /<form/)
  assert.match(html, /href="\/perfil"/)
  assert.equal(p.solicitudes.formulario.personaInicial, null)
  assert.deepEqual(p.solicitudes.fichas, [])
})

test('new members retain the first-review path and malformed context does not create unsafe destinations', async () => {
  const first = pagina({ propias: [] })
  await assert.rejects(first.render(), error => error.ruta === '/registro/resena')
  const p = pagina()
  const html = await p.render({ personaId: 'https://example.com', q: '//example.com?x=1', pagina: '-20' })
  assert.match(html, /<form/)
  assert.match(html, /href="\/fichas\?q=%2F%2Fexample.com%3Fx%3D1"/)
  assert.equal(p.solicitudes.destinos[0], '/resenas/nueva?q=%2F%2Fexample.com%3Fx%3D1')
  assert.equal(p.solicitudes.formulario.personaInicial, null)
  assert.deepEqual(p.solicitudes.fichas, [])
})
