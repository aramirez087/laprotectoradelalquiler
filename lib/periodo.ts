// Fechas de Costa Rica (UTC−6, sin horario de verano).

const OFFSET = '-06:00'
const DIA = 86_400_000

export function hoyCR(ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Costa_Rica',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora)
}

export function esFecha(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const [anio, mes, dia] = valor.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
}

/** Intervalo [inicio, fin) en UTC para un rango de días inclusive en Costa Rica. */
export function rangoInclusivo(desde: string, hasta: string) {
  const inicio = new Date(`${desde}T00:00:00${OFFSET}`)
  const fin = new Date(new Date(`${hasta}T00:00:00${OFFSET}`).getTime() + DIA)
  return { inicio: inicio.toISOString(), fin: fin.toISOString() }
}

export function mesDe(fecha: string) {
  const [anio, mes] = fecha.split('-')
  const ultimo = new Date(Date.UTC(Number(anio), Number(mes), 0)).getUTCDate()
  return { desde: `${anio}-${mes}-01`, hasta: `${anio}-${mes}-${String(ultimo).padStart(2, '0')}` }
}

/** Semana de lunes a domingo, a partir de un día de Costa Rica. */
export function semanaDe(fecha: string) {
  const lunes = new Date(`${fecha}T00:00:00Z`)
  lunes.setUTCDate(lunes.getUTCDate() - (lunes.getUTCDay() + 6) % 7)
  const domingo = new Date(lunes.getTime() + 6 * DIA)
  return { desde: lunes.toISOString().slice(0, 10), hasta: domingo.toISOString().slice(0, 10) }
}

export function anioDe(fecha: string) {
  const anio = fecha.slice(0, 4)
  return { desde: `${anio}-01-01`, hasta: `${anio}-12-31` }
}
