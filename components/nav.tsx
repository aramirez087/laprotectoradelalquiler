'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { cerrarSesion } from '@/lib/actions/auth'
import { Marca } from '@/components/marca'
import { SelectorTema, type Tema } from '@/components/selector-tema'
import type { Rol } from '@/lib/tipos'

export function Nav({ usuario, tema }: { usuario: { nombre: string; rol: Rol } | null; tema: Tema }) {
  const path = usePathname()
  const [rutaAbierta, setRutaAbierta] = useState<string | null>(null)
  const abierto = rutaAbierta === path
  const menu = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function alTeclado(e: KeyboardEvent) {
      if (e.key === 'Escape' && abierto) {
        setRutaAbierta(null)
        menu.current?.focus()
      }
    }
    window.addEventListener('keydown', alTeclado)
    return () => window.removeEventListener('keydown', alTeclado)
  }, [abierto])

  function clase(href: string) {
    const activo = href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`)
    return activo ? 'enlace-nav enlace-nav-activo' : 'enlace-nav'
  }

  function actual(href: string) {
    return path === href || path.startsWith(`${href}/`) ? ('page' as const) : undefined
  }

  const enlaces = (
    <>
      <Link href="/fichas" aria-current={actual('/fichas')} className={clase('/fichas')}>
        Consultar fichas
      </Link>
      <Link href="/resenas/nueva" aria-current={actual('/resenas/nueva')} className={clase('/resenas/nueva')}>
        Escribir reseña
      </Link>
      {usuario?.rol === 'admin' && (
        <Link href="/admin" aria-current={actual('/admin')} className={clase('/admin')}>
          Administración
        </Link>
      )}
      {usuario ? (
        <>
          <Link href="/perfil" aria-current={actual('/perfil')} className={clase('/perfil')}>
            Mi perfil
          </Link>
          <form action={cerrarSesion}>
            <button type="submit" className="enlace-nav">
              Salir
            </button>
          </form>
        </>
      ) : (
        <Link href="/login" aria-current={actual('/login')} className={clase('/login')}>
          Iniciar sesión
        </Link>
      )}
    </>
  )

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-md">
      <div className="cabecera-nav">
        <Link
          href="/"
          onClick={() => setRutaAbierta(null)}
          aria-label="La Protectora del Alquiler, inicio"
          className="marca-nav"
        >
          <Marca />
        </Link>
        <button
          ref={menu}
          type="button"
          className="menu-toggle lg:hidden"
          aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={abierto}
          aria-controls="menu-principal"
          onClick={() => setRutaAbierta(abierto ? null : path)}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d={abierto ? 'm6 6 12 12M6 18 18 6' : 'M4 7h16M4 12h16M4 17h16'} />
          </svg>
        </button>
        <div id="menu-principal" className={abierto ? 'panel-nav panel-nav-abierto' : 'panel-nav'}>
          <nav className="enlaces-principales" aria-label="Principal" onClick={() => setRutaAbierta(null)}>
            {enlaces}
          </nav>
          <div className="tema-nav">
            <span className="text-sm text-ink-soft lg:hidden">Apariencia</span>
            <SelectorTema inicial={tema} />
          </div>
        </div>
      </div>
    </header>
  )
}
