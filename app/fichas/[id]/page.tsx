import { registrarError } from '@/lib/registro-error'
import { correoResenasConfigurado } from '@/lib/correo-resenas'
import type { Metadata } from 'next'
import Link from '@/components/enlace'
import { notFound } from 'next/navigation'
import { FormEditarResena, FormEliminarResena } from '@/components/admin-formularios'
import { EsperaAprobacion } from '@/components/espera-aprobacion'
import { requireUsuario, obtenerFicha, puedeConsultar, resenasPrivadasVisibles } from '@/lib/dal'
import { AvisoConfiguracion } from '@/components/aviso-configuracion'
import { Avatar } from '@/components/avatar'
import { TarjetaResena } from '@/components/tarjeta-resena'
import { EstadoVacio } from '@/components/estado-vacio'
import { sinSupabase } from '@/lib/supabase/server'
import { destinoInterno, etiquetaEstado, fechaCorta, mascararCedula, nombreCompleto } from '@/lib/util'
import type { FilaResenaCompleta } from '@/lib/tipos'

function primer(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v) ?? ''
}

function hrefVolver(q: string, pagina: string) {
  const p = new URLSearchParams()
  if (q) p.set('q', q)
  if (pagina && pagina !== '1') p.set('pagina', pagina)
  const s = p.toString()
  return destinoInterno(s ? `/fichas?${s}` : '/fichas')
}

export const metadata: Metadata = {
  title: 'Ficha privada',
  description: 'La consulta de esta ficha requiere una cuenta y permiso de acceso.',
  robots: { index: false, follow: false, nosnippet: true, noimageindex: true },
  openGraph: null,
  twitter: null,
}

export default async function FichaPage(props: PageProps<'/fichas/[id]'>) {
  const { id } = await props.params
  const personaId = Number(id)
  if (!Number.isInteger(personaId) || personaId <= 0) notFound()

  const searchParams = await props.searchParams
  const volver = hrefVolver(primer(searchParams.q), primer(searchParams.pagina))
  const consulta = volver.includes('?') ? volver.slice(volver.indexOf('?')) : ''
  const usuario = await requireUsuario(`/fichas/${personaId}${consulta}`)
  if (!(await puedeConsultar(usuario))) {
    return <EsperaAprobacion usuario={usuario} />
  }

  if (sinSupabase()) {
    return (
      <div className="contenedor max-w-xl space-y-4">
        <Link href={volver} className="enlace-atras">
          ← Volver a los resultados
        </Link>
        <AvisoConfiguracion />
      </div>
    )
  }

  let persona = null
  try {
    persona = await obtenerFicha(personaId)
  } catch (error) {
    registrarError('page_load_error', error, { route: '/fichas/[id]', routeType: 'render' })
    return (
      <div className="contenedor max-w-xl space-y-4">
        <Link href={volver} className="enlace-atras">
          ← Volver a los resultados
        </Link>
        <div className="expediente space-y-4">
          <h1 className="text-2xl">No pudimos abrir esta ficha</h1>
          <p className="text-sm text-ink-soft">Intente de nuevo en un momento. Su búsqueda se conserva al volver a los resultados.</p>
          <a href={`/fichas/${personaId}${consulta}`} className="btn-secundario">Intentar de nuevo</a>
        </div>
      </div>
    )
  }
  if (!persona) notFound()

  const resenas = ((persona.resenas ?? []) as FilaResenaCompleta[]).filter((r) => r.estado === 'publicada')
  let privadas: Awaited<ReturnType<typeof resenasPrivadasVisibles>> = []
  let avisoPrivadas = false
  try {
    privadas = await resenasPrivadasVisibles(persona.id, usuario)
  } catch (error) {
    registrarError('page_load_error', error, { route: '/fichas/[id]', routeType: 'render' })
    privadas = []
    avisoPrivadas = true
  }
  const verCedulaCompleta =
    usuario.rol === 'admin' ||
    resenas.some((r) => r.propia) ||
    privadas.length > 0 ||
    (usuario.identificacion != null && persona.identificacion === usuario.identificacion)

  const propia = resenas.some((r) => r.propia) || privadas.some((r) => r.propia)
  const ultima = resenas.map((r) => r.creado_en).filter(Boolean).sort().at(-1)
  const nueva = new URLSearchParams(consulta)
  nueva.set('personaId', String(persona.id))
  const nombre = nombreCompleto(persona)

  return (
    <div className="contenedor max-w-4xl space-y-6">
      <Link href={volver} className="enlace-atras">
        ← Volver a los resultados
      </Link>

      <header className="expediente space-y-6 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Avatar nombre={nombre} fotoUrl={persona.foto_url} tamano="lg" />
          <div className="min-w-0 flex-1">
            <p className="eyebrow mb-2">Ficha del inquilino</p>
            <h1 className="break-words text-3xl sm:text-4xl">{nombre}</h1>
            <p className="mt-3 break-words text-sm text-ink-soft">
              Documento {verCedulaCompleta ? persona.identificacion : mascararCedula(persona.identificacion)}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">{resenas.length === 1 ? '1 reseña publicada' : `${resenas.length} reseñas publicadas`}</p>
            {ultima && <p className="text-xs text-ink-soft">Última reseña: <time dateTime={ultima}>{fechaCorta(ultima)}</time></p>}
          </div>
          <Link href={propia ? '/perfil#mis-resenas' : `/resenas/nueva?${nueva}`} className="btn-primario">
            {propia ? 'Ver mi reseña' : 'Escribir reseña'}
          </Link>
        </div>
      </header>
      <div>
        <h2 className="text-xl">Experiencias compartidas</h2>
        <p className="mt-2 text-sm text-ink-soft">Cada reseña refleja la experiencia de quien la escribió.</p>
      </div>
      {resenas.length === 0 ? (
        <EstadoVacio
          icono="documento"
          titulo="Aún no hay reseñas publicadas"
          texto="La ausencia de reseñas no indica un historial positivo o negativo."
        />
      ) : (
        <div className="space-y-4">
          {resenas.map((r) => (
            <TarjetaResena
              key={r.id}
              resena={r}
              puedeDenunciar={!r.propia}
              esAdmin={usuario.rol === 'admin' && usuario.activo}
              persona={persona}
            />
          ))}
        </div>
      )}
      {avisoPrivadas && <p className="aviso aviso-atencion" role="status">No pudimos cargar las reseñas en revisión o rechazadas. Intente abrir la ficha de nuevo en un momento.</p>}
      {privadas.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg">En revisión o rechazadas</h2>
            <p className="mt-1 text-sm text-ink-soft">Estas reseñas todavía no forman parte de las experiencias publicadas.</p>
          </div>
          {privadas.map((r) => (
            <article key={r.id} className="expediente space-y-2 break-words">
              <p className="text-sm text-ink-soft">
                {etiquetaEstado(r.estado)}
                {r.propia ? ' · Su reseña' : ''}
                {r.autor ? ` · ${r.autor}` : ''}
                {r.anonima ? ' · Anónima' : ''}
                {r.creado_en ? ` · ${fechaCorta(r.creado_en)}` : ''}
              </p>
              <p className="whitespace-pre-wrap text-sm">{r.comentario?.trim() || 'Sin comentario.'}</p>
              {r.detalle_verificacion && <p className="text-sm text-ink-soft">{r.detalle_verificacion}</p>}
              {usuario.rol === 'admin' && usuario.activo && (
                <div className="space-y-2 border-t border-line pt-3">
                  <FormEditarResena
                    key={`${r.id}-${persona.id}-${r.comentario ?? ''}-${r.anonima ? 1 : 0}`}
                    id={r.id}
                    persona={persona}
                    comentario={r.comentario}
                    anonima={r.anonima}
                    notificacionesHabilitadas={correoResenasConfigurado()}
                  />
                  <FormEliminarResena id={r.id} notificacionesHabilitadas={correoResenasConfigurado()} />
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
