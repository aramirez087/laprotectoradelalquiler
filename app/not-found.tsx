import Link from 'next/link'

export default function NoEncontrada() {
  return (
    <div className="contenedor max-w-md">
      <h1 className="text-2xl">No encontrada</h1>
      <Link href="/" className="mt-4 inline-block text-sm text-ink-soft">
        Inicio
      </Link>
    </div>
  )
}
