import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { cargarTS } from './helpers/cedula-mocks.mjs'

const cedula = cargarTS('lib/cedula.ts')
const util = cargarTS('lib/util.ts')
const estado = cargarTS('components/cedula-admin.tsx', { '@/lib/cedula': cedula, '@/lib/util': util })
const verificacion = { identificacion: '102340567', estado: 'encontrada', fecha_padron: '2026-08-31', nombre_tse: 'MARÍA SOLÍS', consultado_en: '2026-09-30T12:00:00Z' }
const render = overrides => renderToStaticMarkup(createElement(estado.CedulaAdmin, {
  identificacion: verificacion.identificacion, nombre: 'María Solís', verificacion, ...overrides,
}))

test('saved results render a green check and date without any lookup or async component', () => {
  const html = render()
  assert.match(html, /chip chip-ok/)
  assert.match(html, /✓.*Cédula validada en el TSE/)
  assert.ok(html.includes(util.fechaCorta(verificacion.fecha_padron)))
  assert.doesNotMatch(html, /nombre guardado difiere/)
  assert.match(render({ nombre: 'Nombre distinto' }), /nombre guardado difiere.*MARÍA SOLÍS/)
  assert.match(render({ identificacion: '1-0234-0567' }), /Cédula validada/)
})

test('missing, unmatched, changed and non-national documents never inherit a green check', () => {
  for (const overrides of [{ verificacion: null }, { identificacion: '102340568' }, { identificacion: 'DIMEX12345' },
    { verificacion: { ...verificacion, estado: 'no_encontrada', nombre_tse: null } }]) {
    assert.doesNotMatch(render(overrides), /chip-ok|✓|Cédula validada/)
  }
  assert.match(render({ verificacion: null }), /Sin validación guardada/)
  assert.match(render({ verificacion: { ...verificacion, estado: 'no_encontrada', nombre_tse: null } }), /Sin coincidencia/)
})

test('review cards show the saved result for both the tenant and author', () => {
  const { ResenaAdmin } = cargarTS('components/resena-admin.tsx', {
    '@/components/cedula-admin': estado, '@/lib/util': util,
    '@/lib/correo-resenas': { correoResenasConfigurado: () => false },
    '@/components/admin-formularios': { FormDecision: () => null, FormEditarResena: () => null, FormEliminarResena: () => null },
    '@/components/perfil-facebook': { PerfilFacebook: () => null },
    '@/components/historial-resena': cargarTS('components/historial-resena.tsx', { '@/lib/util': util }),
  })
  const html = renderToStaticMarkup(createElement(ResenaAdmin, { fila: {
    id: 1, creado_en: '2026-09-30', estado: 'borrador', anonima: false, comentario: 'Experiencia', detalle_verificacion: null,
    persona: { id: 1, identificacion: '102340567', nombre: 'María', apellido1: 'Solís', verificacionCedula: verificacion },
    autor: { id: 2, identificacion: '102340567', nombre: 'María Solís', verificacionCedula: verificacion },
  } }))
  assert.equal((html.match(/Cédula validada en el TSE/g) ?? []).length, 2)
})

test('admin loads saved results in one deduplicated batch and never queries the padrón', async () => {
  const consultas = []
  const filas = Array.from({ length: 20 }, (_, id) => ({ id, estado: 'borrador',
    persona: { id: 1, identificacion: '1-0234-0567', nombre: 'María', apellido1: 'Solís' },
    autor: { id: 2, identificacion: '102340567', nombre: 'María Solís' },
  }))
  const db = { from: tabla => {
    assert.ok(['resenas', 'autenticaciones', 'verificaciones_cedula'].includes(tabla))
    consultas.push(tabla)
    const q = { select: () => q, eq: () => q, order: () => q, range: () => q,
      in: (_campo, valores) => { if (tabla === 'verificaciones_cedula') assert.deepEqual(Array.from(valores), ['102340567']); return q },
      then: resolve => resolve({ data: tabla === 'resenas' ? filas : tabla === 'verificaciones_cedula' ? [verificacion] : [], error: null, count: 20 }),
    }
    return q
  } }
  const { consultarResenas } = cargarTS('lib/admin.ts', {
    'server-only': {}, '@/lib/cedula': cedula, '@/lib/util': util,
    '@/lib/dal': { requerirRol: async () => ({ id: 1 }), historialResenas: async () => [] }, '@/lib/acceso-consulta': {}, '@/lib/periodo': {},
    '@/lib/supabase/admin': { createAdmin: () => db },
    '@/lib/padron': { consultarCedula: () => { throw new Error('No page-load lookup allowed') } },
  })
  const resultado = await consultarResenas({ estado: 'borrador' })
  assert.equal(consultas.filter(t => t === 'verificaciones_cedula').length, 1)
  for (const fila of resultado.filas) {
    assert.equal(fila.persona.verificacionCedula.estado, 'encontrada')
    assert.equal(fila.autor.verificacionCedula.estado, 'encontrada')
  }
})
