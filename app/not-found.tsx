import Link from 'next/link'

export default function NoEncontrada() {
  return (
    <div className="contenedor max-w-md">
      <p className="eyebrow mb-3">404 · Página no encontrada</p>
      <h1 className="text-3xl">Aquí no hay una página</h1>
      <p className="mt-3 text-sm text-ink-soft">El enlace puede haber cambiado o la ficha ya no está disponible.</p>
      <Link href="/" className="btn-primario mt-6">
        Volver al inicio
      </Link>
    </div>
  )
}
