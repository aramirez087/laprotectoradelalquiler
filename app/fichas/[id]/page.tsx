import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUsuario, obtenerFicha, resenasPrivadasVisibles } from '@/lib/dal'
import { AvisoConfiguracion } from '@/components/aviso-configuracion'
import { Avatar } from '@/components/avatar'
import { TarjetaResena } from '@/components/tarjeta-resena'
import { sinSupabase } from '@/lib/supabase/server'
import { destinoInterno, etiquetaEstado, fechaCorta, mascararCedula, nombreCompleto } from '@/lib/util'
import type { FilaResenaCompleta } from '@/lib/tipos'

function primer(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v) ?? ''
}

function hrefVolver(q: string, provincia: string, pagina: string) {
  const p = new URLSearchParams()
  if (q) p.set('q', q)
  if (provincia) p.set('provincia', provincia)
  if (pagina && pagina !== '1') p.set('pagina', pagina)
  const s = p.toString()
  return destinoInterno(s ? `/fichas?${s}` : '/fichas')
}

export async function generateMetadata(props: PageProps<'/fichas/[id]'>): Promise<Metadata> {
  const { id } = await props.params
  const personaId = Number(id)
  if (!Number.isInteger(personaId) || personaId <= 0 || sinSupabase()) return { title: 'Ficha' }
  try {
    const persona = await obtenerFicha(personaId)
    return { title: persona ? nombreCompleto(persona) : 'Ficha' }
  } catch {
    return { title: 'Ficha' }
  }
}

export default async function FichaPage(props: PageProps<'/fichas/[id]'>) {
  const { id } = await props.params
  const personaId = Number(id)
  if (!Number.isInteger(personaId) || personaId <= 0) notFound()

  const usuario = await requireUsuario()
  const searchParams = await props.searchParams
  const volver = hrefVolver(primer(searchParams.q), primer(searchParams.provincia), primer(searchParams.pagina))

  if (sinSupabase()) {
    return (
      <div className="contenedor max-w-xl space-y-4">
        <Link href={volver} className="text-sm font-semibold text-ink-soft">
          ← Todas las fichas
        </Link>
        <AvisoConfiguracion />
      </div>
    )
  }

  let persona = null
  try {
    persona = await obtenerFicha(personaId)
  } catch {
    return (
      <div className="contenedor max-w-xl space-y-4">
        <Link href={volver} className="text-sm font-semibold text-ink-soft">
          ← Todas las fichas
        </Link>
        <p className="aviso aviso-error">No pudimos abrir esta ficha. Intente de nuevo en un momento.</p>
      </div>
    )
  }
  if (!persona) notFound()

  const resenas = ((persona.resenas ?? []) as FilaResenaCompleta[]).filter((r) => r.estado === 'publicada')
  let privadas: Awaited<ReturnType<typeof resenasPrivadasVisibles>> = []
  try {
    privadas = await resenasPrivadasVisibles(persona.id, usuario)
  } catch {
    privadas = []
  }
  const verCedulaCompleta =
    usuario.rol === 'admin' ||
    resenas.some((r) => r.autor?.id === usuario.id) ||
    privadas.length > 0 ||
    (usuario.identificacion != null && persona.identificacion === usuario.identificacion)

  const valores = resenas.flatMap((r) => (r.calificacion?.valor ? [r.calificacion.valor] : []))
  const promedio = valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null
  const nombre = nombreCompleto(persona)

  return (
    <div className="contenedor space-y-6">
      <Link href={volver} className="text-sm text-ink-soft">
        Fichas
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar nombre={nombre} fotoUrl={persona.foto_url} tamano="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl">{nombre}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {[
              verCedulaCompleta ? persona.identificacion : mascararCedula(persona.identificacion),
              persona.provincia?.nombre,
              promedio ? promedio.toFixed(1) : null,
              resenas.length === 1 ? '1 reseña' : `${resenas.length} reseñas`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <Link href={`/resenas/nueva?personaId=${persona.id}`} className="text-sm font-medium text-ink">
          Reseña
        </Link>
      </header>
      {resenas.length === 0 && privadas.length === 0 ? (
        <p className="text-sm text-ink-soft">Sin reseñas.</p>
      ) : resenas.length === 0 ? null : (
        <div className="space-y-4">
          {resenas.map((r) => (
            <TarjetaResena key={r.id} resena={r} puedeDenunciar={r.autor?.id !== usuario.id} />
          ))}
        </div>
      )}
      {privadas.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg">En revisión o rechazadas</h2>
          {privadas.map((r) => (
            <article key={r.id} className="expediente space-y-2">
              <p className="text-sm text-ink-soft">
                {etiquetaEstado(r.estado)}
                {r.creado_en ? ` · ${fechaCorta(r.creado_en)}` : ''}
              </p>
              <p className="whitespace-pre-wrap text-sm">{r.comentario?.trim() || 'Sin comentario.'}</p>
              {r.detalle_verificacion && <p className="text-sm text-ink-soft">{r.detalle_verificacion}</p>}
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
