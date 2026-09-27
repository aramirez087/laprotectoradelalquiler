// Utilidades de presentación (español, Costa Rica)

export function nombreCompleto(p: {
  nombre: string
  nombre2?: string | null
  apellido1: string
  apellido2?: string | null
}) {
  return [p.nombre, p.nombre2, p.apellido1, p.apellido2].filter(Boolean).join(' ')
}

/** Enmascara la identificación. Siempre devuelve una máscara, nunca el documento corto. */
export function mascararCedula(c: string | null | undefined) {
  const limpia = (c ?? '').replace(/\D/g, '')
  if (limpia.length < 5) return '••••'
  return `${limpia.slice(0, 3)}····${limpia.slice(-1)}`
}

export function esCedulaValida(c: string | null | undefined) {
  const d = (c ?? '').replace(/\D/g, '')
  return d.length >= 6 && d.length <= 12
}

/** Conserva los guiones que escribió la persona y quita espacios sobrantes. */
export function normalizarCedula(valor: string | null | undefined) {
  return (valor ?? '').trim().replace(/\s+/g, '')
}

const PAGINAS_FACEBOOK = new Set([
  'share',
  'sharer',
  'sharer.php',
  'login',
  'login.php',
  'watch',
  'groups',
  'help',
  'privacy',
  'settings',
  'recover',
  'marketplace',
  'events',
  'pages',
  'stories',
  'reel',
  'reels',
  'photo.php',
  'dialog',
  'plugins',
  'l.php',
  'home.php',
  'gaming',
  'messages',
  'friends',
  'saved',
  'ads',
  'business',
  'legal',
  'policy',
  'policies',
])

function usuarioFacebook(valor: string) {
  if (!/^[A-Za-z0-9.]{5,50}$/.test(valor)) return null
  if (valor.startsWith('.') || valor.endsWith('.') || valor.includes('..')) return null
  if (PAGINAS_FACEBOOK.has(valor.toLowerCase())) return null
  return valor
}

/**
 * Acepta un enlace de Facebook o un usuario suelto y devuelve un perfil https,
 * o null si no parece un perfil.
 */
export function normalizarPerfilFacebook(valor: string | null | undefined): string | null {
  const crudo = (valor ?? '').trim()
  if (!crudo || crudo.length > 300 || /[\s<>]/.test(crudo)) return null

  const pareceUrl = /facebook\.com|fb\.com/i.test(crudo) || /^https?:\/\//i.test(crudo)
  if (!pareceUrl) {
    const usuario = usuarioFacebook(crudo)
    return usuario ? `https://www.facebook.com/${usuario}` : null
  }

  const conProtocolo = /^https?:\/\//i.test(crudo) ? crudo : `https://${crudo.replace(/^\/+/, '')}`
  let url: URL
  try {
    url = new URL(conProtocolo)
  } catch {
    return null
  }
  if (url.username || url.password || (url.protocol !== 'http:' && url.protocol !== 'https:')) return null
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const hostOk =
    host === 'facebook.com' ||
    host === 'm.facebook.com' ||
    host === 'web.facebook.com' ||
    host === 'fb.com' ||
    host === 'm.fb.com'
  if (!hostOk) return null

  const partes = url.pathname.split('/').filter(Boolean).map((parte) => {
    try {
      return decodeURIComponent(parte)
    } catch {
      return parte
    }
  })
  if (partes[0]?.toLowerCase() === 'profile.php' || url.pathname === '/profile.php') {
    const id = (url.searchParams.get('id') ?? '').replace(/\D/g, '')
    if (id.length < 5 || id.length > 20) return null
    return `https://www.facebook.com/profile.php?id=${id}`
  }
  if (partes[0]?.toLowerCase() === 'people') {
    if (partes.length < 2) return null
    return `https://www.facebook.com/${partes.map((parte) => encodeURIComponent(parte)).join('/')}`
  }
  const usuario = partes[0] ? usuarioFacebook(partes[0]) : null
  return usuario ? `https://www.facebook.com/${usuario}` : null
}

export function fechaCorta(iso: string | null | undefined) {
  if (!iso) return null
  const dia = iso.slice(0, 10)
  const d = /^\d{4}-\d{2}-\d{2}$/.test(dia) ? new Date(`${dia}T12:00:00`) : new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function iniciales(nombre: string) {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

const TINTAS = ['#3c4c59', '#4a584f', '#545048', '#464a56', '#3e4e48']

export function tintaDe(nombre: string) {
  let h = 0
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return TINTAS[h % TINTAS.length]
}

export function urlImagen(url: string | null | undefined) {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    return u.href
  } catch {
    return null
  }
}

/**
 * Nombre que puede verse en una ficha. Si la reseña es anónima, el nombre real
 * solo se conserva para administración; cualquier otro valor recibido se ignora.
 */
export function identidadAutorResena(opts: {
  anonima: boolean
  esAdmin: boolean
  nombre?: string | null
  rol?: string | null
}): { nombre: string; rol: string | null; marcaAnonima: boolean } {
  if (opts.anonima && !opts.esAdmin) {
    return { nombre: 'Anónimo', rol: null, marcaAnonima: false }
  }
  if (opts.anonima) {
    return {
      nombre: opts.nombre?.trim() || 'Sin nombre',
      rol: opts.rol ?? null,
      marcaAnonima: true,
    }
  }
  if (!opts.nombre?.trim()) {
    return { nombre: 'Reseña importada', rol: null, marcaAnonima: false }
  }
  return { nombre: opts.nombre, rol: opts.rol ?? null, marcaAnonima: false }
}

export function etiquetaRol(rol: string) {
  const mapa: Record<string, string> = {
    admin: 'Administración',
    propietario: 'Propietario',
    agencia: 'Agencia',
    inquilino: 'Inquilino',
  }
  return mapa[rol] ?? rol
}

export function etiquetaEstado(estado: string) {
  const mapa: Record<string, string> = {
    publicada: 'Publicada',
    borrador: 'En revisión',
    oculta: 'Rechazada',
  }
  return mapa[estado] ?? estado
}

export function esEstadoResena(valor: string): valor is 'borrador' | 'publicada' | 'oculta' {
  return valor === 'borrador' || valor === 'publicada' || valor === 'oculta'
}

export function etiquetaMotivo(motivo: string) {
  const mapa: Record<string, string> = {
    informacion_falsa: 'Información falsa',
    difamacion: 'Difamación',
    datos_incorrectos: 'Datos incorrectos',
    otro: 'Otro',
  }
  return mapa[motivo] ?? motivo
}

export function primer(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v) ?? ''
}

export function paginaSegura(valor: string) {
  const n = Math.floor(Number(valor))
  return Number.isSafeInteger(n) && n > 0 && Number.isSafeInteger(n * 20) ? n : 1
}

export function esMencionNeutra(nombre: string, tipo: 'dano' | 'proceso') {
  const n = nombre.toLowerCase()
  if (tipo === 'dano') return n.includes('sin dañ') || n.includes('sin dano')
  return n.includes('ningun')
}

export function formatoNumero(n: number) {
  return new Intl.NumberFormat('es-CR').format(n)
}

/** Solo rutas internas. Evita que un parámetro de retorno abra otro sitio. */
export function destinoInterno(valor: unknown, porDefecto = '/fichas') {
  if (typeof valor !== 'string') return porDefecto
  if (valor.length === 0 || valor.length > 500) return porDefecto
  const contieneControl = [...valor].some((c) => c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 127)
  if (!valor.startsWith('/') || valor.startsWith('//') || valor.includes('\\') || valor.includes('://') || contieneControl) {
    return porDefecto
  }
  return valor
}

export function palabrasBusqueda(q: string) {
  return q
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length >= 2)
    .slice(0, 5)
}

/** Variantes con y sin tilde para que "Jose" encuentre "José". */
export function variantesAcento(palabra: string) {
  const mapa: Record<string, string[]> = {
    a: ['a', 'á'],
    á: ['a', 'á'],
    e: ['e', 'é'],
    é: ['e', 'é'],
    i: ['i', 'í'],
    í: ['i', 'í'],
    o: ['o', 'ó'],
    ó: ['o', 'ó'],
    u: ['u', 'ú', 'ü'],
    ú: ['u', 'ú', 'ü'],
    ü: ['u', 'ú', 'ü'],
    n: ['n', 'ñ'],
    ñ: ['n', 'ñ'],
  }
  let variantes = ['']
  for (const ch of palabra.toLowerCase()) {
    const ops = mapa[ch] ?? [ch]
    if (ops.length === 1) {
      variantes = variantes.map((v) => v + ops[0])
      continue
    }
    const next: string[] = []
    for (const v of variantes) {
      for (const op of ops) {
        next.push(v + op)
        if (next.length > 32) return [palabra.toLowerCase()]
      }
    }
    variantes = next
  }
  return [...new Set(variantes)]
}
