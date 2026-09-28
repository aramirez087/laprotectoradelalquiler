import Link from 'next/link'
import { accesoConsulta } from '@/lib/dal'
import { mensajeAcceso, REGLAS_CONSULTA, type AccesoConsulta } from '@/lib/acceso-consulta'
import { Icono } from '@/components/icono'
import type { Usuario } from '@/lib/tipos'

export async function EsperaAprobacion({ usuario }: { usuario: Usuario }) {
  const acceso = await accesoConsulta(usuario)
  return <EstadoAcceso acceso={acceso} />
}

export function EstadoAcceso({ acceso }: { acceso: AccesoConsulta }) {
  const { motivo } = acceso
  const activo = motivo !== 'inactiva'
  const vencida = motivo === 'vencida'
  const error = motivo === 'error'
  const revision = motivo === 'revision' || (vencida && acceso.pendientes > 0)
  const rechazada = motivo === 'rechazada'
  const titulo = !activo
    ? 'Su cuenta está inactiva'
    : error
      ? 'No pudimos verificar su acceso'
      : vencida
        ? 'Su permiso de consulta venció'
        : revision
          ? 'Su experiencia está en revisión'
          : rechazada
            ? 'Su reseña necesita atención'
            : 'Su experiencia abre la puerta'
  const texto = mensajeAcceso(acceso)
  const verPerfil = revision || rechazada || !activo || error

  return (
    <div className="pantalla-estado">
      <span className="icono-estado">
        <Icono nombre={revision ? 'reloj' : rechazada ? 'revisar' : 'documento'} />
      </span>
      <p className="eyebrow mt-6">Acceso al registro</p>
      <h1 className="mt-3 text-3xl sm:text-4xl">{titulo}</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-soft">{texto}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href={verPerfil ? '/perfil' : vencida ? '/resenas/nueva' : '/registro/resena'} className="btn-primario">
          {verPerfil ? 'Ver mis reseñas' : vencida ? 'Escribir otra reseña' : 'Escribir mi primera reseña'}
        </Link>
        {activo && !revision && !error && (
          <Link href={rechazada ? '/resenas/nueva' : '/perfil'} className="btn-secundario">
            {rechazada ? 'Escribir otra reseña' : 'Ver mi perfil'}
          </Link>
        )}
      </div>
      {revision && <p className="mt-5 text-xs text-ink-soft">Reenviar la misma experiencia no suma tiempo de consulta.</p>}
      {vencida && revision && <Link href="/resenas/nueva" className="mt-5 text-sm font-semibold text-seal">Compartir una experiencia distinta</Link>}
      {activo && !error && <p className="mt-5 max-w-md text-xs leading-relaxed text-ink-soft">{REGLAS_CONSULTA}</p>}
    </div>
  )
}
