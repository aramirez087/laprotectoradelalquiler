'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ENLACES = [
  { href: '/admin', etiqueta: 'Principal', exacto: true },
  { href: '/admin/resenas', etiqueta: 'Consultar' },
  { href: '/resenas/nueva', etiqueta: 'Reseñar' },
  { href: '/admin/revision', etiqueta: 'Revisión' },
  { href: '/admin/rechazadas', etiqueta: 'Rechazados' },
  { href: '/admin/conteo', etiqueta: 'Conteo' },
  { href: '/admin/usuarios', etiqueta: 'Usuarios' },
  { href: '/admin/reportes', etiqueta: 'Reportes' },
  { href: '/admin/configuracion', etiqueta: 'Configuración' },
]

export function NavAdmin() {
  const path = usePathname()

  return (
    <nav className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Administración">
      {ENLACES.map((enlace) => {
        const activo = enlace.exacto ? path === enlace.href : path === enlace.href || path.startsWith(`${enlace.href}/`)
        return (
          <Link key={enlace.href} href={enlace.href} className={activo ? 'enlace-nav enlace-nav-activo' : 'enlace-nav'}>
            {enlace.etiqueta}
          </Link>
        )
      })}
    </nav>
  )
}
