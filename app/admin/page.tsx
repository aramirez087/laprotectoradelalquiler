import { registrarError } from '@/lib/registro-error'
import { unstable_rethrow } from 'next/navigation'
import Link from '@/components/enlace'
import { resumenAdmin, SinClaveAdmin } from '@/lib/admin'
import { formatoNumero } from '@/lib/util'
import { CabeceraAdmin } from '@/components/admin-ui'

export const metadata = { title: 'Administración' }

const TARJETAS = [
  { clave: 'revision', etiqueta: 'Reseñas en revisión', detalle: 'Pendientes de una decisión', href: '/admin/revision' },
  { clave: 'denuncias', etiqueta: 'Denuncias pendientes', detalle: 'Experiencias que requieren atención', href: '/admin/revision#denuncias' },
  { clave: 'hoy', etiqueta: 'Reseñas de hoy', detalle: 'Ver la actividad del día', href: '/admin/reportes' },
  { clave: 'publicadas', etiqueta: 'Reseñas publicadas', detalle: 'Disponibles en el registro', href: '/admin/resenas?estado=publicada' },
  { clave: 'rechazadas', etiqueta: 'Reseñas rechazadas', detalle: 'Consultar decisiones anteriores', href: '/admin/rechazadas' },
  { clave: 'usuarios', etiqueta: 'Cuentas reales', detalle: 'Activas e inactivas, con o sin inicio de sesión creado', href: '/admin/usuarios' },
] as const

export default async function AdminPage() {
  let resumen = null
  let aviso: string | null = null
  try {
    resumen = await resumenAdmin()
  } catch (e) {
    unstable_rethrow(e)
    registrarError('page_load_error', e, { route: '/admin', routeType: 'render' })
    aviso = e instanceof SinClaveAdmin ? e.message : 'No pudimos cargar el resumen.'
  }

  return (
    <div className="contenedor space-y-7">
      <CabeceraAdmin titulo="Resumen del registro" descripcion="Un vistazo a la actividad de la comunidad. Empiece por las reseñas y denuncias pendientes." accion={<Link href="/admin/revision" className="btn-primario">Revisar pendientes</Link>} />
      {aviso && <p className="aviso aviso-error" role="alert">{aviso}</p>}
      {resumen && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TARJETAS.map((tarjeta) => (
            <Link key={tarjeta.clave} href={tarjeta.href} className="metrico group block">
              <p className="flex items-center justify-between gap-3 text-sm text-ink-soft">{tarjeta.etiqueta}<span aria-hidden="true" className="text-seal">↗</span></p>
              <p className="mt-4 text-4xl font-medium leading-none tracking-tight tabular-nums">
                {formatoNumero(resumen[tarjeta.clave])}
              </p>
              <p className="mt-3 text-xs leading-5 text-ink-soft">{tarjeta.detalle}</p>
            </Link>
          ))}
        </div>
      )}
      {resumen && resumen.autoresLegacy > 0 && (
        <p className="text-sm leading-6 text-ink-soft">
          Además, se conservan{' '}
          <Link href="/admin/usuarios?tipo=legacy" className="enlace-texto font-medium">
            {formatoNumero(resumen.autoresLegacy)} {resumen.autoresLegacy === 1 ? 'autor legacy' : 'autores legacy'}
          </Link>{' '}
          para mantener la autoría de las reseñas. No se incluyen en el total de cuentas reales.
        </p>
      )}
      {resumen && resumen.revision === 0 && resumen.denuncias === 0 && <p className="aviso aviso-ok">Todo al día: no hay reseñas ni denuncias pendientes de revisión.</p>}
    </div>
  )
}
