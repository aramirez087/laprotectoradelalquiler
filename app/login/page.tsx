import { MarcoAcceso } from '@/components/marco-acceso'
import { LoginForm } from '@/components/login-form'
import { AvisoConfiguracion } from '@/components/aviso-configuracion'
import { sinSupabase } from '@/lib/supabase/server'
import { destinoInterno } from '@/lib/util'

export const metadata = { title: 'Entrar' }

function primer(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v
}

export default async function LoginPage(props: PageProps<'/login'>) {
  const searchParams = await props.searchParams
  const siguiente = destinoInterno(primer(searchParams.siguiente))

  return (
    <MarcoAcceso
      titulo="Qué bueno tenerle de vuelta"
      texto={
        siguiente.startsWith('/resenas/nueva')
          ? 'Inicie sesión para compartir su experiencia de alquiler.'
          : 'Inicie sesión para continuar. Para consultar fichas necesita una reseña aprobada.'
      }
    >
      {sinSupabase() ? <AvisoConfiguracion /> : <LoginForm siguiente={siguiente} />}
    </MarcoAcceso>
  )
}
