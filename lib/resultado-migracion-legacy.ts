import * as z from 'zod'

const cantidad = z.number().int().nonnegative()
const SchemaResumen = z.object({
  estado: z.enum(['completada', 'simulacion', 'parcial']),
  lookups: z.record(z.string(), cantidad),
  personas: cantidad,
  usuarios: cantidad,
  resenas: cantidad,
  fichas: z.object({
    leidas: cantidad,
    archivadas: cantidad,
    consolidadas: cantidad,
    conservadas: cantidad,
  }).optional(),
  claves: z.object({ bcrypt: cantidad, anterior: cantidad, restablecer: cantidad }),
  auth: z.object({ creadas: cantidad, fallidas: cantidad }),
  accesos: z.object({
    total: cantidad,
    existentes: cantidad,
    inactivas: cantidad,
    sinCorreo: cantidad,
    sinOrigen: cantidad,
    conflictos: cantidad,
    elegibles: cantidad,
    creadas: cantidad,
    enlazadas: cantidad,
    pendientes: cantidad,
    fallidas: cantidad,
    conservadas: cantidad,
    restablecer: cantidad,
    siguienteId: cantidad.max(2147483647),
  }).optional(),
  previsionAccesos: z.object({
    crear: cantidad,
    enlazar: cantidad,
    claves: z.object({ hashCompatible: cantidad, texto: cantidad, restablecer: cantidad }),
    roles: z.object({ admin: cantidad, propietario: cantidad, agencia: cantidad, inquilino: cantidad }),
    sinDocumentoComparable: cantidad,
  }).optional(),
  advertencias: z.array(z.object({
    codigo: z.string(), mensaje: z.string(), cantidad,
  })),
})

export type ResumenMigracion = z.infer<typeof SchemaResumen>

export function resumenDesdeSalida(salida: string, codigo: number | null): ResumenMigracion {
  const marcador = '=== Resumen ==='
  const inicio = salida.lastIndexOf(marcador)
  if (inicio < 0) throw new Error('La migración terminó sin entregar un resumen.')
  let json: unknown
  try { json = JSON.parse(salida.slice(inicio + marcador.length).trim()) }
  catch { throw new Error('La migración entregó un resumen ilegible.') }
  const parsed = SchemaResumen.safeParse(json)
  if (!parsed.success) throw new Error('La migración entregó un resumen incompleto.')
  if (![0, 2].includes(codigo ?? -1) || (codigo === 2) !== (parsed.data.estado === 'parcial')
    || (parsed.data.auth.fallidas > 0 && parsed.data.estado !== 'parcial')) {
    throw new Error('La migración entregó un estado inconsistente.')
  }
  const accesos = parsed.data.accesos
  if (accesos && (
    accesos.total !== accesos.existentes + accesos.inactivas + accesos.sinCorreo + accesos.sinOrigen + accesos.conflictos + accesos.elegibles
    || accesos.elegibles !== accesos.creadas + accesos.enlazadas + accesos.pendientes
    || accesos.creadas !== accesos.conservadas + accesos.restablecer
    || accesos.fallidas > accesos.pendientes
    || ((accesos.pendientes + accesos.conflictos + accesos.sinOrigen > 0) && !['parcial', 'simulacion'].includes(parsed.data.estado))
  )) throw new Error('La migración entregó un conteo de accesos inconsistente.')
  const prevision = parsed.data.previsionAccesos
  if (prevision && (parsed.data.estado !== 'simulacion' || !accesos
    || prevision.crear + prevision.enlazar !== accesos.elegibles
    || prevision.crear !== Object.values(prevision.claves).reduce((total, n) => total + n, 0)
    || accesos.elegibles !== Object.values(prevision.roles).reduce((total, n) => total + n, 0)
    || prevision.sinDocumentoComparable > accesos.elegibles
    || accesos.creadas + accesos.enlazadas + accesos.fallidas !== 0
  )) throw new Error('La migración entregó una previsión de accesos inconsistente.')
  return parsed.data
}
