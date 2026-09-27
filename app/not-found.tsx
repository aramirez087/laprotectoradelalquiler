import { Icono } from '@/components/icono'
import Link from 'next/link'

export default function NoEncontrada() {
  return (
    <div className="pantalla-estado">
      <span className="icono-estado mb-5"><Icono nombre="buscar" /></span>
      <p className="eyebrow mb-3">404 · Página no encontrada</p>
      <h1 className="text-3xl">No encontramos esta página</h1>
      <p className="mt-3 text-sm text-ink-soft">El enlace puede haber cambiado o la ficha ya no está disponible.</p>
      <Link href="/" className="btn-primario mt-6">
        Volver al inicio
      </Link>
    </div>
  )
}
