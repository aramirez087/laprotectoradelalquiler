/** Only fixed categories leave the site. Never send URLs, queries or record IDs. */
export const PAGINAS_AUDIENCIA = {
  inicio: 'Inicio', ejemplo: 'Consulta de ejemplo', como_funciona: 'Cómo funciona', privacidad: 'Privacidad',
  guias: 'Guías para propietarios', guia_referencias: 'Guía de referencias de inquilinos',
  guia_preguntas: 'Preguntas para arrendadores', guia_resena: 'Cómo escribir una reseña',
  login: 'Iniciar sesión', registro: 'Registro', primera_resena: 'Primera reseña',
  fichas: 'Consulta de fichas', ficha: 'Detalle de ficha',
  nueva_resena: 'Escribir reseña', perfil: 'Mi perfil',
} as const

export const FUENTES_AUDIENCIA = {
  directo: 'Acceso directo', google: 'Google', facebook: 'Facebook',
  instagram: 'Instagram', bing: 'Bing', otros: 'Otros sitios',
} as const

export const DISPOSITIVOS_AUDIENCIA = {
  movil: 'Celular', tableta: 'Tableta', computadora: 'Computadora',
} as const

export function paginaAudiencia(path: string): keyof typeof PAGINAS_AUDIENCIA | null {
  const rutas: Record<string, keyof typeof PAGINAS_AUDIENCIA> = {
    '/': 'inicio', '/ejemplo': 'ejemplo', '/como-funciona': 'como_funciona', '/privacidad': 'privacidad',
    '/guias': 'guias', '/guias/referencias-de-inquilinos': 'guia_referencias',
    '/guias/preguntas-para-arrendadores': 'guia_preguntas', '/guias/como-escribir-una-resena': 'guia_resena',
    '/login': 'login', '/registro': 'registro', '/registro/resena': 'primera_resena',
    '/fichas': 'fichas', '/resenas/nueva': 'nueva_resena', '/perfil': 'perfil',
  }
  if (Object.hasOwn(rutas, path)) return rutas[path]
  return /^\/fichas\/\d+$/.test(path) ? 'ficha' : null
}

/** Explicit event, route and trigger allowlists; DOM values never become telemetry. */
const EVENTOS_PUBLICOS_AUDIENCIA = {
  inicio_ejemplo: { ruta: '/', tipo: 'clic' },
  ejemplo_con_resenas: { ruta: '/ejemplo', tipo: 'clic' },
  ejemplo_sin_resultados: { ruta: '/ejemplo', tipo: 'clic' },
  ejemplo_registro: { ruta: '/ejemplo', tipo: 'clic' },
  registro_desde_ejemplo: { ruta: '/registro', tipo: 'visita' },
  guia_referencias_registro: { ruta: '/guias/referencias-de-inquilinos', tipo: 'clic' },
  guia_preguntas_registro: { ruta: '/guias/preguntas-para-arrendadores', tipo: 'clic' },
  guia_resena_registro: { ruta: '/guias/como-escribir-una-resena', tipo: 'clic' },
} as const

export function eventoPublicoAudiencia(valor: string | null, path: string, tipo: 'clic' | 'visita') {
  if (!valor || !Object.hasOwn(EVENTOS_PUBLICOS_AUDIENCIA, valor)) return null
  const nombre = valor as keyof typeof EVENTOS_PUBLICOS_AUDIENCIA
  const evento = EVENTOS_PUBLICOS_AUDIENCIA[nombre]
  return evento.ruta === path && evento.tipo === tipo ? `site_public_${nombre}` : null
}

const METRICAS_EJEMPLO_AUDIENCIA = {
  site_page_ejemplo: 'Visitas a la consulta de ejemplo',
  site_public_inicio_ejemplo: 'Clics para ver el ejemplo desde el inicio',
  site_public_ejemplo_con_resenas: 'Interacciones con el caso con reseñas',
  site_public_ejemplo_sin_resultados: 'Interacciones con el caso sin resultados',
  site_public_ejemplo_registro: 'Clics para compartir una experiencia',
  site_public_registro_desde_ejemplo: 'Visitas al registro con origen «ejemplo»',
} as const

const METRICAS_GUIAS_AUDIENCIA = {
  site_public_guia_referencias_registro: 'Clics al registro desde la guía de referencias',
  site_public_guia_preguntas_registro: 'Clics al registro desde las preguntas para arrendadores',
  site_public_guia_resena_registro: 'Clics al registro desde la guía para escribir reseñas',
} as const

export function fuenteAudiencia(referrer: string, origin: string): keyof typeof FUENTES_AUDIENCIA {
  try {
    const url = new URL(referrer)
    if (url.origin === origin) return 'directo'
    const host = url.hostname.toLowerCase()
    if (/^(?:[^.]+\.)?google\.(?:com|co\.cr|[a-z]{2})$/.test(host)) return 'google'
    if (/(^|\.)(facebook\.com|fb\.com)$/.test(host)) return 'facebook'
    if (/(^|\.)instagram\.com$/.test(host)) return 'instagram'
    if (/(^|\.)bing\.com$/.test(host)) return 'bing'
    return 'otros'
  } catch { return 'directo' }
}

export function dispositivoAudiencia(userAgent: string): keyof typeof DISPOSITIVOS_AUDIENCIA {
  if (/ipad|tablet|android(?!.*mobile)/i.test(userAgent)) return 'tableta'
  return /mobile|iphone|ipod|android/i.test(userAgent) ? 'movil' : 'computadora'
}

export function eventosAudiencia(pagina: keyof typeof PAGINAS_AUDIENCIA, dispositivo: keyof typeof DISPOSITIVOS_AUDIENCIA,
  fuente: keyof typeof FUENTES_AUDIENCIA | null) {
  return [
    'site_page_view', `site_page_${pagina}`, `site_device_${dispositivo}`,
    ...(fuente === null ? [] : ['site_session_start', `site_source_${fuente}`]),
  ]
}

export type PeriodoAudiencia = 7 | 28
export function periodoAudiencia(valor: string): PeriodoAudiencia { return valor === '28' ? 28 : 7 }

/** Statsig's default fixed GMT-8 day closes at 02:00 in Costa Rica. Exclude the open day. */
export function fechasAudiencia(periodo: PeriodoAudiencia, ahora = new Date()) {
  const cerrado = new Date(ahora.getTime() - 8 * 3_600_000 - 86_400_000)
  return Array.from({ length: periodo }, (_, i) =>
    new Date(cerrado.getTime() - (periodo - 1 - i) * 86_400_000).toISOString().slice(0, 10))
}

export interface ValorAudiencia { metricName: string; metricType: string; unitType: string; value: number }
export interface DiaAudiencia { fecha: string; valores: ValorAudiencia[] | null }

function valorMetricas(valores: ValorAudiencia[], nombre: string, tipo?: string) {
  const filas = valores.filter(v => v.metricName === nombre && (!tipo || v.metricType === tipo))
  // Different unit types describe the same traffic: never add them together.
  for (const unidad of tipo === 'event_count' ? ['overall', 'userID'] : ['userID', 'overall']) {
    const fila = filas.find(v => v.unitType === unidad)
    if (fila) return fila.value
  }
  return null
}

export function resumirAudiencia(dias: DiaAudiencia[], periodo: PeriodoAudiencia) {
  const ultimo = dias.at(-1)
  const validos = dias.filter((d): d is DiaAudiencia & { valores: ValorAudiencia[] } =>
    d.valores !== null && valorMetricas(d.valores, 'site_page_view', 'event_count') !== null)
  const sumar = (nombre: string) => validos.reduce((total, dia) =>
    total + (valorMetricas(dia.valores, nombre, 'event_count') ?? 0), 0)
  const lista = (categorias: Record<string, string>, prefijo: string) => Object.entries(categorias)
    .map(([clave, etiqueta]) => ({ etiqueta, cantidad: sumar(`${prefijo}${clave}`) }))
    .filter(v => v.cantidad > 0).sort((a, b) => b.cantidad - a.cantidad)
  const metricasUltimo = ultimo?.valores ?? []
  const interacciones = (metricas: Record<string, string>) => Object.entries(metricas).map(([nombre, etiqueta]) => {
    const valores = dias.map(dia => dia.valores ? valorMetricas(dia.valores, nombre, 'event_count') : null)
      .filter((valor): valor is number => valor !== null)
    return { etiqueta, cantidad: valores.length ? valores.reduce((s, v) => s + v, 0) : null,
      diasDisponibles: valores.length }
  })
  return {
    disponible: validos.length > 0,
    completo: validos.length === dias.length,
    diasDisponibles: validos.length,
    visitantes: valorMetricas(metricasUltimo, periodo === 7 ? 'weekly_active_user' : 'monthly_active_user'),
    nuevos: valorMetricas(metricasUltimo, periodo === 7 ? 'new_wau' : 'new_mau_28d'),
    vistas: validos.length ? sumar('site_page_view') : null,
    sesiones: validos.length ? sumar('site_session_start') : null,
    paginas: lista(PAGINAS_AUDIENCIA, 'site_page_'),
    fuentes: lista(FUENTES_AUDIENCIA, 'site_source_'),
    dispositivos: lista(DISPOSITIVOS_AUDIENCIA, 'site_device_'),
    ejemplo: interacciones(METRICAS_EJEMPLO_AUDIENCIA),
    guias: interacciones(METRICAS_GUIAS_AUDIENCIA),
    serie: dias.map(d => ({ fecha: d.fecha,
      vistas: d.valores ? valorMetricas(d.valores, 'site_page_view', 'event_count') : null,
      visitantes: d.valores ? valorMetricas(d.valores, 'daily_active_user') : null,
    })),
  }
}
