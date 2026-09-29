import { Icono } from '@/components/icono'
import Link from 'next/link'
import { BarrioVivo } from '@/components/barrio-vivo'
import { AvisoConfiguracion } from '@/components/aviso-configuracion'
import { EsperaAprobacion } from '@/components/espera-aprobacion'
import { obtenerUsuario, puedeConsultar } from '@/lib/dal'
import { sinSupabase } from '@/lib/supabase/server'
import { BENEFICIO_CONSULTA, REGLAS_CONSULTA } from '@/lib/acceso-consulta'

export default async function HomePage() {
  const usuario = await obtenerUsuario()
  if (usuario && !(await puedeConsultar(usuario))) {
    return <EsperaAprobacion usuario={usuario} />
  }

  return (
    <div className="inicio">
      <BarrioVivo />
      <p className="eyebrow contexto-inicio mt-5">Una comunidad informada · Costa Rica</p>
      <h1 className="titulo-inicio mt-5">
        Conozca mejor<br />
        <span className="text-seal">a su inquilino.</span>
      </h1>
      <p className="mt-5 max-w-md text-pretty text-base leading-relaxed text-ink-soft">
        Experiencias de alquiler en Costa Rica, compartidas por quienes las vivieron.
      </p>
      <form action="/fichas" method="GET" className="mt-8 w-full max-w-xl text-left" role="search" aria-label="Consultar reseñas">
        <label className="etiqueta-campo mb-2.5 ml-5" htmlFor="q">
          ¿A quién desea consultar?
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
            aria-describedby={usuario ? 'ayuda-busqueda' : 'ayuda-busqueda requisito-consulta'}
          />
          <button type="submit" className="boton-buscar">
            Buscar <Icono nombre="flecha" className="h-4 w-4" />
          </button>
        </div>
      </form>
      {!usuario && (
        <p id="requisito-consulta" className="mt-4 max-w-md text-xs leading-relaxed text-ink-soft">
          Para consultar, necesita una cuenta y una reseña aprobada.
        </p>
      )}
      <p id="ayuda-busqueda" className="mt-2 inline-flex items-center gap-1.5 text-center text-xs text-ink-soft">
        <Icono nombre="escudo" className="h-3.5 w-3.5 shrink-0" />
        La cédula completa no se muestra al público.
      </p>
      <Link href="/resenas/nueva" className="enlace-inicio mt-5">
        Comparta su experiencia <Icono nombre="flecha" className="h-4 w-4" />
      </Link>
      {!usuario && (
        <details className="como-funciona mt-1 w-full max-w-md text-left">
          <summary className="mx-auto flex w-fit cursor-pointer items-center gap-2 text-sm text-ink-soft">
            Cómo funciona{' '}
            <span className="indicador-detalle" aria-hidden="true">
              +
            </span>
          </summary>
          <ol className="mt-3 space-y-5 rounded-2xl border border-line bg-card p-5 sm:p-6">
            <li className="flex gap-3">
              <span className="numero-paso">1</span>
              <div>
                <p className="text-sm font-medium">Cree su cuenta</p>
                <p className="mt-1 text-sm text-ink-soft">Regístrese con su correo electrónico.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="numero-paso">2</span>
              <div>
                <p className="text-sm font-medium">Comparta una experiencia</p>
                <p className="mt-1 text-sm text-ink-soft">
                  Administración revisa su reseña antes de publicarla.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="numero-paso">3</span>
              <div>
                <p className="text-sm font-medium">Consulte el registro</p>
                <p className="mt-1 text-sm text-ink-soft">{BENEFICIO_CONSULTA}</p>
              </div>
            </li>
          </ol>
          <p className="mt-3 text-xs leading-relaxed text-ink-soft">{REGLAS_CONSULTA}</p>
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
