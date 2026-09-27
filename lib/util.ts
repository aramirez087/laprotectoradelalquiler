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
