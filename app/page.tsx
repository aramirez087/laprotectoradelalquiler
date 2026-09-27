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
    <div className="flex min-h-[72vh] flex-col items-center justify-center px-4 pb-16">
      <h1 className="text-[2.75rem] font-normal tracking-tight sm:text-6xl">La Protectora</h1>
      <form action="/fichas" method="GET" className="mt-8 w-full max-w-xl" role="search">
        <label className="sr-only" htmlFor="q">
          Nombre o cédula
        </label>
        <div className="buscador">
          <input id="q" name="q" type="search" placeholder="Nombre o cédula" autoComplete="off" />
          <button type="submit" className="mr-1.5 rounded-full px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink">
            Buscar
          </button>
        </div>
      </form>
      {sinSupabase() && (
        <div className="mt-6 w-full max-w-xl">
          <AvisoConfiguracion />
        </div>
      )}
    </div>
  )
}
