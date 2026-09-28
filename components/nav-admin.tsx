'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ENLACES = [
  { href: '/admin', etiqueta: 'Resumen', exacto: true },
  { href: '/admin/revision', etiqueta: 'Revisión' },
  { href: '/admin/resenas', etiqueta: 'Reseñas' },
  { href: '/admin/rechazadas', etiqueta: 'Rechazadas' },
  { href: '/admin/conteo', etiqueta: 'Por usuario' },
  { href: '/admin/usuarios', etiqueta: 'Usuarios' },
  { href: '/admin/reportes', etiqueta: 'Reportes' },
  { href: '/admin/migracion', etiqueta: 'Importar datos' },
  { href: '/admin/configuracion', etiqueta: 'Configuración' },
]

export function NavAdmin() {
  const path = usePathname()

  return (
    <nav className="nav-admin min-w-0 py-1" aria-label="Administración">
      {ENLACES.map((enlace) => {
        const activo = enlace.exacto ? path === enlace.href : path === enlace.href || path.startsWith(`${enlace.href}/`)
        return (
          <Link key={enlace.href} href={enlace.href} aria-current={activo ? 'page' : undefined} className={activo ? 'enlace-nav enlace-nav-activo' : 'enlace-nav'}>
            {enlace.etiqueta}
          </Link>
        )
      })}
    </nav>
  )
}
