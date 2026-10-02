import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { cargarTS } from './helpers/cedula-mocks.mjs'

const util = cargarTS('lib/util.ts')
const perfil = cargarTS('app/perfil/page.tsx', {
  '@/lib/dal': {
    requireUsuario: async () => ({ id: 7, nombre: 'María', email: 'maria@example.test', rol: 'propietario', activo: true }),
    accesoConsulta: async () => ({ puede_consultar: true }), perfilFacebookDe: async () => null, horaServidor: () => '',
    historialResenas: async () => [], listarResenasDe: async () => [],
  },
  '@/components/form-clave': { FormClave: () => null }, '@/components/permiso-consulta': { PanelPermiso: () => null },
  '@/lib/actions/auth': { cerrarSesion: () => {} },
  '@/lib/facebook-auth': { authFacebookHabilitado: () => false, mensajeErrorFacebook: () => null },
  '@/lib/supabase/server': { sinSupabase: () => false }, '@/lib/util': util,
  '@/components/avatar': { Avatar: () => null }, '@/components/icono': { Icono: () => null },
  '@/components/perfil-facebook': { PerfilFacebook: () => null },
  '@/components/form-corregir-resena': { FormCorregirResena: () => null },
  '@/components/historial-resena': { HistorialResena: () => null },
})

const render = async params => renderToStaticMarkup(await perfil.default({ searchParams: Promise.resolve(params) }))

test('automatically published submissions show publication and suppress stale pending notices', async () => {
  for (const params of [{ publicada: '1' }, { publicada: '1', enviada: '1' }, { publicada: '1', corregida: '1' }]) {
    const html = await render(params)
    assert.match(html, /Su reseña fue aprobada y publicada/)
    assert.match(html, /permiso actualizado/)
    assert.doesNotMatch(html, /Recibimos su reseña|Recibimos su corrección|pendiente de revisión|envío todavía no cambia/)
  }
})

test('submission and correction receipts leave final status and access to the persisted profile data', async () => {
  for (const params of [{ enviada: '1' }, { corregida: '1' }]) {
    const html = await render(params)
    assert.match(html, /Recibimos su (reseña|corrección)/)
    assert.match(html, /Consulte.*estado.*Mis reseñas/)
    assert.doesNotMatch(html, /fue aprobada y publicada|permiso actualizado|pendiente de revisión|envío todavía no cambia/)
  }
})
