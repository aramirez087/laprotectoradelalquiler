import { enlaceFacebook } from '@/lib/enlace-facebook'

export function PerfilFacebook({ valor, etiqueta = 'Perfil de Facebook', className }: {
  valor: string
  etiqueta?: string
  className?: string
}) {
  const href = enlaceFacebook(valor)
  if (!href) return <span className="break-words">Facebook: {valor}</span>

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {etiqueta}<span className="sr-only"> (se abre en una pestaña nueva)</span>
    </a>
  )
}
