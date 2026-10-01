import Link from '@/components/enlace'
import { Avatar } from '@/components/avatar'
import { Icono } from '@/components/icono'
import { fechaCorta, mascararCedula, nombreCompleto } from '@/lib/util'
import type { VistaFicha } from '@/lib/tipos'
import { etiquetaCoincidencia } from '@/lib/busqueda-fichas'

export function TarjetaFicha({ ficha, href }: { ficha: VistaFicha; href: string }) {
  const nombre = nombreCompleto(ficha.persona)
  const coincidencia = etiquetaCoincidencia(ficha.coincidencia ?? undefined)
  return (
    <Link href={href} className="expediente fila-ficha group">
      <Avatar nombre={nombre} fotoUrl={ficha.persona.foto_url} />
      <div className="min-w-0">
        <h3 className="break-words text-lg font-medium leading-snug tracking-tight group-hover:text-seal">{nombre}</h3>
        {coincidencia && <p className="mt-1 text-xs font-medium text-seal">{coincidencia}</p>}
        <p className="mt-1 break-words text-sm text-ink-soft">
          Documento {mascararCedula(ficha.persona.identificacion)}
        </p>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-ink-soft">
          <span className="font-medium text-seal">{ficha.resenas === 1 ? '1 reseña publicada' : `${ficha.resenas} reseñas publicadas`}</span>
          {ficha.ultima && <span>Última reseña: <time dateTime={ficha.ultima}>{fechaCorta(ficha.ultima)}</time></span>}
        </p>
      </div>
      <Icono nombre="flecha" className="hidden text-ink-soft sm:block" />
    </Link>
  )
}
