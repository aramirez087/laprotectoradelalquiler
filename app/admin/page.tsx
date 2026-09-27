import Link from 'next/link'
import { resumenAdmin, SinClaveAdmin } from '@/lib/admin'
import { formatoNumero } from '@/lib/util'

export const metadata = { title: 'Administración' }

const TARJETAS = [
  { clave: 'hoy', etiqueta: 'Hoy', href: '/admin/reportes' },
  { clave: 'revision', etiqueta: 'En revisión', href: '/admin/revision' },
  { clave: 'rechazadas', etiqueta: 'Rechazadas', href: '/admin/rechazadas' },
  { clave: 'publicadas', etiqueta: 'Publicadas', href: '/admin/resenas?estado=publicada' },
  { clave: 'usuarios', etiqueta: 'Usuarios', href: '/admin/usuarios' },
  { clave: 'denuncias', etiqueta: 'Denuncias', href: '/admin/revision#denuncias' },
] as const

export default async function AdminPage() {
  let resumen = null
  let aviso: string | null = null
  try {
    resumen = await resumenAdmin()
  } catch (e) {
    aviso = e instanceof SinClaveAdmin ? e.message : 'No pudimos cargar el resumen.'
  }

  return (
    <div className="contenedor space-y-6">
      <h1 className="text-3xl">Principal</h1>
      {aviso && <p className="aviso aviso-error">{aviso}</p>}
      {resumen && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TARJETAS.map((tarjeta) => (
            <Link key={tarjeta.clave} href={tarjeta.href} className="metrico block">
              <p className="text-sm text-ink-soft">{tarjeta.etiqueta}</p>
              <p className="mt-1 text-[1.7rem] font-medium leading-none tracking-tight">
                {formatoNumero(resumen[tarjeta.clave])}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
