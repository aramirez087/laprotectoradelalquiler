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
    <div className="inicio aparecer">
      <Image src="/images/barrio.webp" alt="" width={1000} height={500} sizes="(max-width: 640px) 280px, 380px" loading="eager" className="ilustracion-inicio" />
      <p className="eyebrow mt-5">Alquilar empieza con confianza</p>
      <h1 className="mt-3 text-[2.85rem] font-medium tracking-[-0.055em] sm:text-[4.25rem]">La Protectora<span className="mt-1 block text-base font-normal tracking-[0.04em] text-ink-soft sm:text-lg">del Alquiler</span></h1>
      <p className="mt-5 max-w-sm text-center text-sm leading-relaxed text-ink-soft sm:max-w-md sm:text-base">Experiencias compartidas para tomar decisiones más informadas.</p>
      <form action="/fichas" method="GET" className="mt-7 w-full max-w-xl" role="search">
        <label className="sr-only" htmlFor="q">
          Nombre o cédula
        </label>
        <div className="buscador buscador-inicio">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" className="mr-3 shrink-0 text-ink-soft" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" strokeLinecap="round" /></svg>
          <input id="q" name="q" type="search" placeholder="Nombre o cédula" maxLength={150} autoComplete="off" aria-describedby="ayuda-busqueda" />
          <button type="submit" className="boton-buscar">
            Buscar
          </button>
        </div>
      </form>
      <p id="ayuda-busqueda" className="mt-4 text-center text-xs text-ink-soft">La cédula completa no se muestra al público.</p>
      <Link href="/resenas/nueva" className="enlace-inicio mt-8">Comparta su experiencia <span aria-hidden="true">↗</span></Link>
      {!usuario && <p className="mt-3 max-w-sm text-center text-xs leading-relaxed text-ink-soft">Para consultar, inicie sesión y tenga una reseña aprobada.</p>}
      {sinSupabase() && (
        <div className="mt-6 w-full max-w-xl">
          <AvisoConfiguracion />
        </div>
      )}
    </div>
  )
}
import Image from 'next/image'
import Link from 'next/link'
