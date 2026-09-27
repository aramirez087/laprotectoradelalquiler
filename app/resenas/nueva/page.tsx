import Link from 'next/link'
import { requireUsuario, obtenerLookups, obtenerFicha, resenasPrivadasVisibles } from '@/lib/dal'
import { FormResena } from '@/components/form-resena'
import { AvisoConfiguracion } from '@/components/aviso-configuracion'
import { sinSupabase } from '@/lib/supabase/server'
import { createAdmin } from '@/lib/supabase/admin'
import { mascararCedula } from '@/lib/util'

export const metadata = { title: 'Escribir reseña' }

export default async function NuevaResenaPage(props: PageProps<'/resenas/nueva'>) {
  const usuario = await requireUsuario()
  const searchParams = await props.searchParams
  const personaId = Number(searchParams.personaId ?? 0) || null

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

  if (personaId && lookups) {
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
        <h1 className="text-2xl">Reseña</h1>
        {usuario.rol !== 'admin' && createAdmin() && (
          <p className="mt-2 text-sm text-ink-soft">La reseña se publica cuando administración la revisa.</p>
        )}
      </div>
      {aviso && <p className="aviso aviso-error">{aviso}</p>}
      {lookups && <FormResena personaInicial={personaInicial} lookups={lookups} />}
      <Link href="/fichas" className="text-sm font-semibold text-ink-soft">
        ← Volver a fichas
      </Link>
    </div>
  )
}
