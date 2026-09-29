import { redirect } from 'next/navigation'
import { crearResenaAction } from '@/lib/actions/resenas'
import Link from 'next/link'
import {
  requireUsuario,
  obtenerFicha,
  puedeConsultar,
  resenasPrivadasVisibles,
  listarResenasDe,
} from '@/lib/dal'
import { FormResena } from '@/components/form-resena'
import { AvisoConfiguracion } from '@/components/aviso-configuracion'
import { sinSupabase } from '@/lib/supabase/server'
import { mascararCedula, primer } from '@/lib/util'
import { REGLAS_CONSULTA } from '@/lib/acceso-consulta'

export const metadata = { title: 'Escribir reseña' }

export default async function NuevaResenaPage(props: PageProps<'/resenas/nueva'>) {
  const searchParams = await props.searchParams
  const id = Number(primer(searchParams.personaId))
  const personaId = Number.isSafeInteger(id) && id > 0 ? id : null
  const usuario = await requireUsuario(personaId ? `/resenas/nueva?personaId=${personaId}` : '/resenas/nueva')
  const consulta = await puedeConsultar(usuario)

  if (!usuario.activo)
    return (
      <div className="contenedor max-w-xl space-y-4">
        <h1 className="text-3xl">Su cuenta está inactiva</h1>
        <p className="text-ink-soft">
          En este momento no puede enviar reseñas. Puede revisar el estado de las que ya escribió en su
          perfil.
        </p>
        <Link href="/perfil" className="btn-secundario">
          Ver mi perfil
        </Link>
      </div>
    )

  if (usuario.rol !== 'admin') {
    let sinResenas = false
    try {
      sinResenas = (await listarResenasDe(usuario.id)).length === 0
    } catch {
      sinResenas = false
    }
    if (sinResenas) redirect('/registro/resena')
  }

  if (sinSupabase()) {
    return (
      <div className="contenedor max-w-xl">
        <AvisoConfiguracion />
      </div>
    )
  }

  let personaInicial: {
    personaId: number
    identificacion: string
    nombre: string
    nombre2: string | null
    apellido1: string
    apellido2: string | null
  } | null = null

  if (personaId && consulta) {
    const p = await obtenerFicha(personaId).catch(() => null)
    if (p) {
      const privadas = await resenasPrivadasVisibles(p.id, usuario).catch(() => [])
      const puedeVer =
        usuario.rol === 'admin' ||
        (usuario.identificacion != null && usuario.identificacion === p.identificacion) ||
        (p.resenas ?? []).some((r) => r.propia && r.estado === 'publicada') ||
        privadas.length > 0
      personaInicial = {
        personaId: p.id,
        identificacion: puedeVer ? p.identificacion : mascararCedula(p.identificacion),
        nombre: p.nombre,
        nombre2: p.nombre2,
        apellido1: p.apellido1,
        apellido2: p.apellido2,
      }
    }
  }

  return (
    <div className="contenedor max-w-3xl space-y-6">
      <Link href={personaInicial ? `/fichas/${personaInicial.personaId}` : consulta ? '/fichas' : '/perfil'} className="enlace-atras">
        {personaInicial ? '← Volver a la ficha' : consulta ? '← Volver a reseñas' : '← Volver a mi perfil'}
      </Link>
      <header>
        <p className="eyebrow mb-3">Aporte a la comunidad</p>
        <h1 className="text-3xl sm:text-4xl">Comparta su experiencia</h1>
        {usuario.rol !== 'admin' && (
          <p className="mt-2 text-sm text-ink-soft">
            La reseña se envía a revisión. Se publica cuando administración la aprueba.
            {' '}{REGLAS_CONSULTA}
          </p>
        )}
      </header>
      <FormResena
        accion={crearResenaAction}
        personaInicial={personaInicial}
        enRevision={usuario.rol !== 'admin'}
      />
    </div>
  )
}
