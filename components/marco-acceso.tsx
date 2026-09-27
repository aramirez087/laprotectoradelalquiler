import Link from 'next/link'
import { Icono } from '@/components/icono'

export function MarcoAcceso({
  titulo,
  texto,
  children,
}: {
  titulo: string
  texto: string
  children: React.ReactNode
}) {
  return (
    <div className="acceso">
      <Link href="/" className="enlace-atras">
        ← Volver al inicio
      </Link>
      <section className="acceso-panel">
        <span className="icono-estado mb-5">
          <Icono nombre="escudo" />
        </span>
        <h1 className="text-3xl">{titulo}</h1>
        <p className="mb-7 mt-3 text-sm leading-relaxed text-ink-soft">{texto}</p>
        {children}
      </section>
      <p className="mt-5 text-center text-xs leading-relaxed text-ink-soft">
        Experiencias compartidas. Una comunidad más informada.
      </p>
    </div>
  )
}
