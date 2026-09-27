'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { cerrarSesion } from '@/lib/actions/auth'
import { Marca } from '@/components/marca'
import type { Rol } from '@/lib/tipos'

export function Nav({ usuario }: { usuario: { nombre: string; rol: Rol } | null }) {
  const path = usePathname()
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    function alTeclado(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false)
    }
    window.addEventListener('keydown', alTeclado)
    return () => window.removeEventListener('keydown', alTeclado)
  }, [])

  function clase(href: string) {
    const activo = href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`)
    return activo ? 'enlace-nav enlace-nav-activo' : 'enlace-nav'
  }

  const enlaces = (
    <>
      <Link href="/fichas" className={clase('/fichas')}>
        Fichas
      </Link>
      <Link href="/resenas/nueva" className={clase('/resenas/nueva')}>
        Reseña
      </Link>
      {usuario?.rol === 'admin' && (
        <Link href="/admin" className={clase('/admin')}>
          Administración
        </Link>
      )}
      {usuario ? (
        <>
          <Link href="/perfil" className={clase('/perfil')}>
            Perfil
          </Link>
          <form action={cerrarSesion}>
            <button type="submit" className="enlace-nav">
              Salir
            </button>
          </form>
        </>
      ) : (
        <Link href="/login" className={clase('/login')}>
          Entrar
        </Link>
      )}
    </>
  )

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="La Protectora del Alquiler, inicio">
          <Marca />
        </Link>
        <button
          type="button"
          className="btn-secundario md:hidden"
          aria-expanded={abierto}
          aria-controls="menu-principal"
          onClick={() => setAbierto((v) => !v)}
        >
          {abierto ? 'Cerrar' : 'Menú'}
        </button>
        <nav className="hidden items-center gap-4 md:flex" aria-label="Principal">
          {enlaces}
        </nav>
      </div>
      {abierto && (
        <nav
          id="menu-principal"
          className="flex flex-col gap-1 border-t border-line px-4 py-3 md:hidden"
          aria-label="Principal"
          onClick={() => setAbierto(false)}
        >
          {enlaces}
        </nav>
      )}
    </header>
  )
}
