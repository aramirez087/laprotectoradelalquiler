import { FormularioBusqueda } from '@/components/formulario-busqueda'
import Link from '@/components/enlace'
import { redirect } from 'next/navigation'
import { Icono } from '@/components/icono'
import { BarrioVivo } from '@/components/barrio-vivo'
import { AvisoConfiguracion } from '@/components/aviso-configuracion'
import { EsperaAprobacion } from '@/components/espera-aprobacion'
import { ContenidoInicio } from '@/components/contenido-seo'
import { JsonLd } from '@/components/json-ld'
import { destinoTrasLogin, obtenerUsuario, puedeConsultar } from '@/lib/dal'
import { sinSupabase } from '@/lib/supabase/server'
import { datosSitio, DESCRIPCION_SITIO, metadataPublica } from '@/lib/seo'

export const metadata = metadataPublica({
  titulo: 'Reseñas de inquilinos en Costa Rica | La Protectora',
  descripcion: DESCRIPCION_SITIO,
  ruta: '/',
})

function CabeceraInicio({ publica = false }: { publica?: boolean }) {
  return (
    <>
      <BarrioVivo />
      <p className="eyebrow contexto-inicio mt-5">Propietarios y agencias · Costa Rica</p>
      <h1 className="titulo-inicio mt-5">
        {publica ? 'Reseñas de inquilinos.' : 'Proteja su propiedad.'}<br />
        <span className="text-seal">Alquile con confianza.</span>
      </h1>
      <p className="descripcion-inicio mt-5 text-pretty text-base leading-relaxed text-ink-soft sm:text-lg">
        {publica
          ? 'Consulte experiencias de propietarios y agencias en Costa Rica antes de alquilar su propiedad.'
          : 'Experiencias de otros propietarios para elegir mejor a su inquilino.'}
      </p>
    </>
  )
}

function RespaldoComunidad() {
  return <p className="text-ink-soft">Experiencias compartidas. Mejores decisiones.</p>
}

export default async function HomePage() {
  const usuario = await obtenerUsuario()
  if (!usuario) {
    return (
      <>
        <JsonLd datos={datosSitio} />
        <div className="inicio inicio-publico">
          <CabeceraInicio publica />
          <div className="acciones-inicio mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/registro" className="btn-primario">
              Unirme a La Protectora <Icono nombre="flecha" className="h-4 w-4 shrink-0" />
            </Link>
            <Link href="/login" className="btn-secundario">Iniciar sesión</Link>
          </div>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-soft">
            Su primera reseña aprobada le da <strong className="font-medium text-ink">3 meses de consultas gratis.</strong>
          </p>
          <div className="prueba-inicio">
            <Icono nombre="documento" className="h-5 w-5 shrink-0 text-seal" />
            <RespaldoComunidad />
          </div>
          {sinSupabase() && (
            <div className="mt-6 w-full max-w-xl">
              <AvisoConfiguracion />
            </div>
          )}
        </div>
        <ContenidoInicio />
      </>
    )
  }

  if (!(await puedeConsultar(usuario))) {
    if (usuario.auth_user_id) {
      const destino = await destinoTrasLogin(usuario.auth_user_id, '/')
      if (destino !== '/') redirect(destino)
    }
    return <EsperaAprobacion usuario={usuario} />
  }

  return (
    <div className="inicio">
      <CabeceraInicio />
      <FormularioBusqueda action="/fichas"  className="mt-8 w-full max-w-xl text-left" role="search" aria-label="Consultar reseñas">
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
            aria-describedby="ayuda-busqueda"
          />
          <button type="submit" className="boton-buscar">
            Buscar <Icono nombre="flecha" className="h-4 w-4" />
          </button>
        </div>
      </FormularioBusqueda>
      <p id="ayuda-busqueda" className="mt-2 inline-flex items-center gap-1.5 text-center text-xs text-ink-soft">
        <Icono nombre="escudo" className="h-3.5 w-3.5 shrink-0" />
        Use la cédula completa para distinguir personas con nombres similares.
      </p>
      <Link href="/resenas/nueva" className="enlace-inicio mt-5">
        Comparta su experiencia <Icono nombre="flecha" className="h-4 w-4" />
      </Link>
    </div>
  )
}
