import Link from 'next/link'
import { Avatar } from '@/components/avatar'
import { CalificacionEstrellas } from '@/components/calificacion-estrellas'
import { Icono } from '@/components/icono'
import { fechaCorta, mascararCedula, nombreCompleto } from '@/lib/util'
import type { VistaFicha } from '@/lib/tipos'

export function TarjetaFicha({ ficha, href }: { ficha: VistaFicha; href: string }) {
  const nombre = nombreCompleto(ficha.persona)
  return (
    <Link href={href} className="expediente fila-ficha group">
      <Avatar nombre={nombre} fotoUrl={ficha.persona.foto_url} />
      <div className="min-w-0">
        <h3 className="break-words text-lg font-medium leading-snug tracking-tight group-hover:text-seal">{nombre}</h3>
        <p className="mt-1 break-words text-sm text-ink-soft">
          {[ficha.provincia, `Documento ${mascararCedula(ficha.persona.identificacion)}`]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <p className="mt-1 text-xs text-ink-soft">
          {ficha.resenas === 1 ? '1 reseña' : `${ficha.resenas} reseñas`}
          {ficha.ultima ? ` · Última reseña: ${fechaCorta(ficha.ultima)}` : ''}
        </p>
      </div>
      <div className="valoracion-ficha">
        <CalificacionEstrellas valor={ficha.promedio} />
      </div>
      <Icono nombre="flecha" className="hidden text-ink-soft sm:block" />
    </Link>
  )
}
