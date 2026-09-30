import { registrarError } from '@/lib/registro-error'
import { redirect } from 'next/navigation'
import { crearResenaAction } from '@/lib/actions/resenas'
import Link from '@/components/enlace'
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
import { mascararCedula, paginaSegura, primer } from '@/lib/util'

export const metadata = { title: 'Escribir reseña' }

function hrefConBusqueda(ruta: string, q: string, pagina: number, personaId?: number | null) {
  const params = new URLSearchParams()
  if (personaId) params.set('personaId', String(personaId))
  if (q) params.set('q', q)
  if (pagina > 1) params.set('pagina', String(pagina))
  const consulta = params.toString()
  return consulta ? `${ruta}?${consulta}` : ruta
}

export default async function NuevaResenaPage(props: PageProps<'/resenas/nueva'>) {
  const searchParams = await props.searchParams
  const id = Number(primer(searchParams.personaId))
  const personaId = Number.isSafeInteger(id) && id > 0 ? id : null
  const q = primer(searchParams.q).trim()
  const pagina = paginaSegura(primer(searchParams.pagina))
  const destino = hrefConBusqueda('/resenas/nueva', q, pagina, personaId)
  const usuario = await requireUsuario(destino)
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

  if (usuario.rol !== 'admin' || personaId) {
    let propias: Awaited<ReturnType<typeof listarResenasDe>> | null = null
    try {
      propias = await listarResenasDe(usuario.id)
    } catch (error) {
      registrarError('page_load_error', error, { route: '/resenas/nueva', routeType: 'render' })
      propias = null
    }
    if (personaId && propias?.some((r) => r.persona_id === personaId)) redirect('/perfil#mis-resenas')
    if (usuario.rol !== 'admin' && propias?.length === 0) redirect('/registro/resena')
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

  const volver = consulta
    ? hrefConBusqueda(personaId ? `/fichas/${personaId}` : '/fichas', q, pagina)
    : '/perfil'

  if (personaId && !consulta) {
    return (
      <div className="contenedor max-w-xl space-y-4">
        <Link href="/perfil" className="enlace-atras">← Volver a mi perfil</Link>
        <h1 className="text-3xl">No puede consultar esta ficha</h1>
        <p className="text-sm leading-relaxed text-ink-soft">
          Revise su permiso de consulta en su perfil. Puede compartir otra experiencia ingresando los datos del inquilino.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/perfil#acceso-consultas" className="btn-secundario">Ver mi permiso</Link>
          <Link href="/resenas/nueva" className="btn-primario">Compartir otra experiencia</Link>
        </div>
      </div>
    )
  }

  if (personaId) {
    const { persona: p, fallo: falloFicha } = await obtenerFicha(personaId).then(
      (persona) => ({ persona, fallo: false }),
      () => ({ persona: null, fallo: true }),
    )
    if (!p) {
      return (
        <div className="contenedor max-w-xl space-y-4">
          <Link href={hrefConBusqueda('/fichas', q, pagina)} className="enlace-atras">← Volver a los resultados</Link>
          <h1 className="text-3xl">{falloFicha ? 'No pudimos cargar la ficha' : 'No encontramos esta ficha'}</h1>
          <p className="text-sm leading-relaxed text-ink-soft">
            {falloFicha
              ? 'Intente de nuevo en un momento. Su búsqueda se conserva al volver.'
              : 'Vuelva a los resultados para buscar al inquilino antes de escribir la reseña.'}
          </p>
          {falloFicha && (
            <a href={destino} className="btn-secundario">Intentar de nuevo</a>
          )}
        </div>
      )
    }
    const privadas = await resenasPrivadasVisibles(p.id, usuario).catch(() => [])
    if ((p.resenas ?? []).some((r) => r.propia) || privadas.some((r) => r.propia)) redirect('/perfil#mis-resenas')
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

  return (
    <div className="contenedor max-w-3xl space-y-6">
      <Link href={volver} className="enlace-atras">
        {personaInicial ? '← Volver a la ficha' : consulta ? '← Volver a reseñas' : '← Volver a mi perfil'}
      </Link>
      <header>
        <p className="eyebrow mb-3">Aporte a la comunidad</p>
        <h1 className="text-3xl sm:text-4xl">Comparta su experiencia</h1>
        {usuario.rol !== 'admin' && (
          <p className="mt-2 text-sm text-ink-soft">
            La reseña se envía a revisión. Se publica cuando administración la aprueba.
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
