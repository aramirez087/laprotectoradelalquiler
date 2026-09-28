import { Icono } from '@/components/icono'
import Link from 'next/link'
import { BarrioVivo } from '@/components/barrio-vivo'
import { AvisoConfiguracion } from '@/components/aviso-configuracion'
import { EsperaAprobacion } from '@/components/espera-aprobacion'
import { obtenerUsuario, puedeConsultar } from '@/lib/dal'
import { sinSupabase } from '@/lib/supabase/server'

export default async function HomePage() {
  const usuario = await obtenerUsuario()
  if (usuario && !(await puedeConsultar(usuario))) {
    return <EsperaAprobacion usuario={usuario} />
  }

  return (
    <div className="inicio">
      <BarrioVivo />
      <p className="eyebrow mt-5">Alquilar empieza con confianza</p>
      <h1 className="mt-3 text-[2.85rem] font-medium tracking-[-0.055em] sm:text-[4.25rem]">
        La Protectora
        <span className="mt-1 block text-base font-normal tracking-[0.04em] text-ink-soft sm:text-lg">
          del Alquiler
        </span>
      </h1>
      <p className="mt-5 max-w-sm text-center text-sm leading-relaxed text-ink-soft sm:max-w-md sm:text-base">
        Experiencias de alquiler en Costa Rica, compartidas por quienes las vivieron.
      </p>
      {!usuario && (
        <p className="mt-5 max-w-md text-xs leading-relaxed text-ink-soft">
          Para consultar necesita una cuenta y una reseña aprobada.
        </p>
      )}
      <form action="/fichas" method="GET" className="mt-5 w-full max-w-xl" role="search">
        <label className="sr-only" htmlFor="q">
          Nombre o cédula
        </label>
        <div className="buscador buscador-inicio">
          <Icono nombre="buscar" className="mr-3 shrink-0 text-ink-soft" />
          <input
            id="q"
            name="q"
            type="search"
            placeholder="Nombre o cédula"
            maxLength={150}
            autoComplete="off"
            aria-describedby="ayuda-busqueda"
          />
          <button type="submit" className="boton-buscar">
            Buscar
          </button>
        </div>
      </form>
      <p id="ayuda-busqueda" className="mt-4 text-center text-xs text-ink-soft">
        La cédula completa no se muestra al público.
      </p>
      <Link href="/resenas/nueva" className="enlace-inicio mt-8">
        Comparta su experiencia <span aria-hidden="true">↗</span>
      </Link>
      {!usuario && (
        <details className="como-funciona mt-3 w-full max-w-md text-left">
          <summary className="mx-auto flex w-fit cursor-pointer items-center gap-2 text-sm text-ink-soft">
            Cómo funciona{' '}
            <span className="indicador-detalle" aria-hidden="true">
              +
            </span>
          </summary>
          <ol className="mt-5 space-y-4 border-t border-line pt-5">
            <li className="flex gap-3">
              <span className="numero-paso">1</span>
              <div>
                <p className="text-sm font-medium">Cree su cuenta</p>
                <p className="mt-1 text-xs text-ink-soft">Regístrese con su correo electrónico.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="numero-paso">2</span>
              <div>
                <p className="text-sm font-medium">Comparta una experiencia</p>
                <p className="mt-1 text-xs text-ink-soft">
                  Administración revisa su reseña antes de publicarla.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="numero-paso">3</span>
              <div>
                <p className="text-sm font-medium">Consulte el registro</p>
                <p className="mt-1 text-xs text-ink-soft">Una reseña aprobada le da acceso a las fichas.</p>
              </div>
            </li>
          </ol>
          <Link href="/registro" className="enlace-texto mt-4">
            Crear mi cuenta <Icono nombre="flecha" />
          </Link>
        </details>
      )}
      {sinSupabase() && (
        <div className="mt-6 w-full max-w-xl">
          <AvisoConfiguracion />
        </div>
      )}
    </div>
  )
}
