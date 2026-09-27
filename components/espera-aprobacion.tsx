import Link from 'next/link'
import { motivoEspera, type MotivoEspera } from '@/lib/dal'
import { Icono } from '@/components/icono'
import type { Usuario } from '@/lib/tipos'

export async function EsperaAprobacion({ usuario }: { usuario: Usuario }) {
  const motivo = await motivoEspera(usuario)
  return <EstadoAcceso motivo={motivo} activo={usuario.activo} />
}

export function EstadoAcceso({ motivo, activo }: { motivo: MotivoEspera; activo: boolean }) {
  const revision = motivo === 'revision'
  const rechazada = motivo === 'rechazada'
  const titulo = !activo
    ? 'Su cuenta está inactiva'
    : revision
      ? 'Su experiencia está en revisión'
      : rechazada
        ? 'Su reseña necesita atención'
        : 'Su experiencia abre la puerta'
  const texto = !activo
    ? 'Puede revisar sus reseñas y el estado de su cuenta desde su perfil.'
    : revision
      ? 'Ya recibimos su reseña. Cuando administración la apruebe, podrá buscar y consultar las fichas del registro.'
      : rechazada
        ? 'Consulte el motivo en su perfil antes de enviar otra reseña. Necesita una reseña aprobada para acceder al registro.'
        : 'Comparta una experiencia de alquiler. Cuando administración la apruebe, podrá consultar las experiencias de la comunidad.'

  return (
    <div className="pantalla-estado">
      <span className="icono-estado">
        <Icono nombre={revision ? 'reloj' : rechazada ? 'revisar' : 'documento'} />
      </span>
      <p className="eyebrow mt-6">Acceso al registro</p>
      <h1 className="mt-3 text-3xl sm:text-4xl">{titulo}</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-soft">{texto}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href={revision || rechazada || !activo ? '/perfil' : '/resenas/nueva'} className="btn-primario">
          {revision || rechazada || !activo ? 'Ver mis reseñas' : 'Escribir mi primera reseña'}
        </Link>
        {activo && !revision && (
          <Link href={rechazada ? '/resenas/nueva' : '/perfil'} className="btn-secundario">
            {rechazada ? 'Escribir otra reseña' : 'Ver mi perfil'}
          </Link>
        )}
      </div>
      {revision && (
        <p className="mt-5 text-xs text-ink-soft">No necesita enviar otra reseña mientras espera.</p>
      )}
    </div>
  )
}
