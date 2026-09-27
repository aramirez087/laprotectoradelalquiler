import { crearResenaAction } from '@/lib/actions/resenas'
import Link from 'next/link'
import {
  requireUsuario,
  obtenerLookups,
  obtenerFicha,
  puedeConsultar,
  resenasPrivadasVisibles,
} from '@/lib/dal'
import { FormResena } from '@/components/form-resena'
import { AvisoConfiguracion } from '@/components/aviso-configuracion'
import { sinSupabase } from '@/lib/supabase/server'
import { createAdmin } from '@/lib/supabase/admin'
import { mascararCedula, primer } from '@/lib/util'

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

  if (sinSupabase()) {
    return (
      <div className="contenedor max-w-xl">
        <AvisoConfiguracion />
      </div>
    )
  }

  let lookups: Awaited<ReturnType<typeof obtenerLookups>> | null = null
  let aviso: string | null = null
  try {
    lookups = await obtenerLookups()
  } catch {
    aviso = 'No pudimos cargar las listas del formulario. Intente de nuevo en un momento.'
  }

  let personaInicial: {
    personaId: number
    identificacion: string
    cedulaCompleta: boolean
    nombre: string
    nombre2: string | null
    apellido1: string
    apellido2: string | null
    provinciaId: number | null
  } | null = null

  if (personaId && lookups && consulta) {
    const p = await obtenerFicha(personaId).catch(() => null)
    if (p) {
      const privadas = await resenasPrivadasVisibles(p.id, usuario).catch(() => [])
      const puedeVer =
        usuario.rol === 'admin' ||
        (usuario.identificacion != null && usuario.identificacion === p.identificacion) ||
        (p.resenas ?? []).some((r) => r.autor?.id === usuario.id && r.estado === 'publicada') ||
        privadas.length > 0
      personaInicial = {
        personaId: p.id,
        identificacion: puedeVer ? p.identificacion : mascararCedula(p.identificacion),
        cedulaCompleta: puedeVer,
        nombre: p.nombre,
        nombre2: p.nombre2,
        apellido1: p.apellido1,
        apellido2: p.apellido2,
        provinciaId: p.provincia_id,
      }
    }
  }

  return (
    <div className="contenedor max-w-3xl space-y-6">
      <div>
        <p className="eyebrow mb-3">Una experiencia que ayuda</p>
        <h1 className="text-3xl sm:text-4xl">Comparta su experiencia</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Cuente lo que vivió durante el alquiler. Los detalles concretos ayudan a otras personas a entender
          su experiencia.
        </p>
        {usuario.rol !== 'admin' && createAdmin() && (
          <p className="mt-2 text-sm text-ink-soft">
            La reseña se publica cuando administración la revisa.
            {!consulta && ' Con una reseña aprobada puede consultar fichas.'}
          </p>
        )}
      </div>
      {aviso && <p className="aviso aviso-error">{aviso}</p>}
      {lookups && (
        <FormResena
          accion={crearResenaAction}
          personaInicial={personaInicial}
          lookups={lookups}
          enRevision={usuario.rol !== 'admin' && !!createAdmin()}
        />
      )}
      <Link href={consulta ? '/fichas' : '/perfil'} className="text-sm font-semibold text-ink-soft">
        {consulta ? '← Volver a fichas' : '← Perfil'}
      </Link>
    </div>
  )
}
