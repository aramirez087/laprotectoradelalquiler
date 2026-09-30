const rutas = new Set([
  '/', '/login', '/registro', '/registro/facebook', '/registro/resena', '/fichas', '/fichas/[id]',
  '/resenas/nueva', '/perfil', '/recuperar', '/restablecer', '/invitacion/admin', '/como-funciona', '/privacidad',
  '/admin', '/admin/revision', '/admin/rechazadas', '/admin/resenas', '/admin/conteo', '/admin/usuarios',
  '/admin/usuarios/[id]', '/admin/configuracion', '/admin/reportes', '/auth/facebook/datos',
  '/auth/facebook/retorno', '/auth/facebook/eliminacion/estado',
])

/** Only route patterns; no query strings, record IDs or arbitrary paths. */
export function rutaDiagnostico(path: unknown) {
  if (typeof path !== 'string') return undefined
  const ruta = path.replace(/^\/fichas\/\d+$/, '/fichas/[id]').replace(/^\/admin\/usuarios\/\d+$/, '/admin/usuarios/[id]')
  return rutas.has(ruta) ? ruta : undefined
}
