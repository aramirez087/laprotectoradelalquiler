import Link from 'next/link'
import type { ReactNode } from 'react'
import { formatoNumero } from '@/lib/util'

export function CabeceraAdmin({ titulo, descripcion, accion }: { titulo: string; descripcion: string; accion?: ReactNode }) {
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 max-w-3xl">
        <p className="eyebrow mb-3">Administración</p>
        <h1 className="break-words text-3xl sm:text-4xl">{titulo}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">{descripcion}</p>
      </div>
      {accion && <div className="shrink-0">{accion}</div>}
    </header>
  )
}

export function VacioAdmin({ titulo, descripcion, href, accion }: { titulo: string; descripcion: string; href?: string; accion?: string }) {
  return (
    <div className="expediente px-5 py-8 sm:px-7">
      <p className="text-lg font-medium">{titulo}</p>
      <p className="mt-2 max-w-xl text-sm leading-6 text-ink-soft">{descripcion}</p>
      {href && accion && <Link href={href} className="btn-secundario mt-4">{accion}</Link>}
    </div>
  )
}

export function ResultadosAdmin({ pagina, tamano, total, unidad = 'reseñas' }: { pagina: number; tamano: number; total: number; unidad?: string }) {
  if (total === 0) return null
  if (total === 1) return <p className="text-sm text-ink-soft">1 {unidad === 'usuarios' ? 'usuario' : 'reseña'}</p>
  const desde = (pagina - 1) * tamano + 1
  const hasta = Math.min(pagina * tamano, total)
  return <p className="text-sm text-ink-soft">Mostrando <span className="font-medium text-ink">{formatoNumero(desde)}–{formatoNumero(hasta)}</span> de {formatoNumero(total)} {unidad}</p>
}
