import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BarrioVivo } from '@/components/barrio-vivo'
import { AvisoConfiguracion } from '@/components/aviso-configuracion'
import { EsperaAprobacion } from '@/components/espera-aprobacion'
import { destinoTrasLogin, obtenerUsuario, puedeConsultar } from '@/lib/dal'
import { sinSupabase } from '@/lib/supabase/server'

export default async function HomePage() {
  const usuario = await obtenerUsuario()
  if (!usuario) {
    return (
      <div className="inicio">
        <BarrioVivo />
        <p className="eyebrow contexto-inicio mt-5">Propietarios y agencias · Costa Rica</p>
        <h1 className="titulo-inicio mt-5">
          Inicie sesión<br />
          <span className="text-seal">o regístrese.</span>
        </h1>
        <p className="mt-5 max-w-md text-pretty text-base leading-relaxed text-ink-soft">
          Un espacio exclusivo para propietarios y agencias que comparten experiencias sobre sus alquileres.
        </p>
        <div className="mt-8 grid w-full max-w-md gap-5 sm:grid-cols-2 sm:gap-4">
          <div>
            <p className="mb-2 text-sm text-ink-soft">¿Ya tiene cuenta?</p>
            <Link href="/login" className="btn-primario w-full">Iniciar sesión</Link>
          </div>
          <div>
            <p className="mb-2 text-sm text-ink-soft">¿Es su primera visita?</p>
            <Link href="/registro" className="btn-secundario w-full">Registrarse</Link>
          </div>
        </div>
        <p className="mt-6 max-w-md text-sm leading-relaxed text-ink-soft">
          Si ya tiene acceso vigente, entrará directamente a consultas. Si es nuevo, le guiaremos para escribir su primera reseña.
        </p>
        <p className="mt-3 max-w-md text-xs leading-relaxed text-ink-soft">
          Su primera reseña aprobada le da 3 meses para consultar el registro.
        </p>
        {sinSupabase() && (
          <div className="mt-6 w-full max-w-xl">
            <AvisoConfiguracion />
          </div>
        )}
      </div>
    )
  }

  if (await puedeConsultar(usuario)) redirect('/fichas')

  if (usuario.auth_user_id) {
    const destino = await destinoTrasLogin(usuario.auth_user_id, '/')
    if (destino !== '/') redirect(destino)
  }
  return <EsperaAprobacion usuario={usuario} />
}
