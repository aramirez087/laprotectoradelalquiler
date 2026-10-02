import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { cargarTS } from './helpers/cedula-mocks.mjs'

const cedula = cargarTS('lib/cedula.ts')
const util = cargarTS('lib/util.ts')
const estado = cargarTS('components/cedula-admin.tsx', { '@/lib/cedula': cedula, '@/lib/util': util })
const verificacion = { identificacion: '102340567', estado: 'encontrada', fecha_padron: '2026-08-31', nombre_tse: 'MARÍA SOLÍS', consultado_en: '2026-09-30T12:00:00Z' }
const moderacion = { resena_id: 1, version_evaluada: 1, version_resultante: 1, decision: 'revision',
  motivo: 'contenido_sensible', modelo: 'groq/modelo', politica: 'resenas-v1', categorias: ['datos_personales'], evaluada_en: '2026-10-01' }
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

test('automatic evaluation details explain human deferral and flag older versions without changing human decisions', () => {
  const { ResenaAdmin } = cargarTS('components/resena-admin.tsx', {
    '@/components/cedula-admin': estado, '@/lib/util': util,
    '@/lib/correo-resenas': { correoResenasConfigurado: () => false },
    '@/components/admin-formularios': { FormDecision: () => createElement('button', null, 'Decidir reseña'), FormEditarResena: () => null, FormEliminarResena: () => null },
    '@/components/perfil-facebook': { PerfilFacebook: () => null },
    '@/components/historial-resena': cargarTS('components/historial-resena.tsx', { '@/lib/util': util }),
  })
  const fila = { id: 1, version: 2, creado_en: '2026-09-30', estado: 'borrador', anonima: false,
    comentario: 'Experiencia', detalle_verificacion: null, moderacionAutomatica: moderacion,
    persona: { id: 1, identificacion: '102340567', nombre: 'María', apellido1: 'Solís' }, autor: null }
  const render = overrides => renderToStaticMarkup(createElement(ResenaAdmin, { fila: { ...fila, ...overrides } }))
  const html = render()
  assert.match(html, /Derivada a revisión humana/)
  assert.match(html, /contenido sensible/)
  assert.match(html, /Indicadores: Datos personales/)
  assert.match(html, /versión anterior/)
  assert.match(html, /groq\/modelo|resenas-v1/)
  assert.match(html, /Decidir reseña/)
  assert.doesNotMatch(render({ version: 1 }), /versión anterior/)
  assert.doesNotMatch(render({ moderacionAutomatica: null }), /Última evaluación automática/)
  assert.match(render({ moderacionAutomatica: { ...moderacion, motivo: '__proto__', categorias: ['constructor'] } }), /Requiere revisión humana.*Contenido por revisar/s)
  assert.match(render({ version: 1, moderacionAutomatica: { ...moderacion, decision: 'obsoleta' } }), /Evaluación no aplicada.*versión anterior/s)
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

test('administrator audit RPC scopes and batches visible reviews and failures preserve the human queue', async () => {
  for (const [failure, cantidad, incluirModeracion] of [[false, 1, true], [true, 1, true], [false, 41, true], [false, 1, false]]) {
    const llamadas = [], errores = []
    const fila = { id: 1, version: 1, estado: 'borrador', persona: { id: 2, identificacion: '102340567', nombre: 'María', apellido1: 'Solís' }, autor: null }
    const db = {
      rpc: async (nombre, args) => {
        llamadas.push({ nombre, args })
        return failure ? { data: null, error: { code: 'PGRST202' } }
          : { data: args.p_resena_ids.slice(0, 20).map(id => ({ ...moderacion, resena_id: id })), error: null }
      },
      from: tabla => {
        const q = { select: () => q, eq: () => q, order: () => q, range: () => q, in: () => q,
          then: resolve => resolve({ data: tabla === 'resenas' ? Array.from({ length: cantidad }, (_, i) => ({ ...fila, id: i + 1 })) : [], error: null, count: cantidad }) }
        return q
      },
    }
    const { consultarResenas } = cargarTS('lib/admin.ts', {
      'server-only': {}, '@/lib/cedula': cedula, '@/lib/util': util,
      '@/lib/dal': { requerirRol: async () => ({ id: 7 }), historialResenas: async () => [] }, '@/lib/acceso-consulta': {}, '@/lib/periodo': {},
      '@/lib/supabase/admin': { createAdmin: () => db },
      '@/lib/registro-error': { registrarError: (...args) => errores.push(args) },
    })
    const resultado = await consultarResenas({ estado: 'borrador', limite: cantidad, incluirModeracion })
    assert.equal(resultado.filas.length, cantidad)
    assert.equal(llamadas.length, !incluirModeracion ? 0 : failure ? 1 : Math.ceil(cantidad / 20))
    for (const llamada of llamadas) {
      assert.equal(llamada.nombre, 'admin_moderacion_automatica_resenas')
      assert.equal(llamada.args.p_admin_id, 7)
      assert.ok(llamada.args.p_resena_ids.length <= 20)
    }
    if (incluirModeracion && !failure) {
      assert.deepEqual(llamadas.flatMap(llamada => Array.from(llamada.args.p_resena_ids)), Array.from({ length: cantidad }, (_, i) => i + 1))
      assert.ok(resultado.filas.every(fila => fila.moderacionAutomatica?.resena_id === fila.id))
    } else assert.ok(resultado.filas.every(fila => fila.moderacionAutomatica === null))
    assert.equal(errores.length, failure ? 1 : 0)
  }
})
