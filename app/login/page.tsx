import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { MarcoAcceso } from '@/components/marco-acceso'
import { LoginForm } from '@/components/login-form'
import { AvisoConfiguracion } from '@/components/aviso-configuracion'
import { altaFacebookPendiente } from '@/lib/facebook-alta'
import { authFacebookHabilitado, mensajeErrorFacebook, rutaAltaFacebook, rutaEntrarConFacebook } from '@/lib/facebook-auth'
import { COOKIE_CORREO, correoRecordado } from '@/lib/correo-recordado'
import { sinSupabase } from '@/lib/supabase/server'
import { destinoInterno, primer } from '@/lib/util'

export const metadata = { title: 'Entrar' }

export default async function LoginPage(props: PageProps<'/login'>) {
  const searchParams = await props.searchParams
  const siguiente = destinoInterno(primer(searchParams.siguiente))
  const correo = correoRecordado((await cookies()).get(COOKIE_CORREO)?.value)
  if (!sinSupabase() && (await altaFacebookPendiente())) redirect(rutaAltaFacebook(siguiente))

  return (
    <MarcoAcceso
      titulo="Qué bueno tenerle de vuelta"
      texto={
        siguiente.startsWith('/resenas/nueva')
          ? 'Inicie sesión para compartir su experiencia de alquiler.'
          : 'Inicie sesión para continuar. Para consultar reseñas necesita una reseña aprobada.'
      }
    >
      {sinSupabase() ? (
        <AvisoConfiguracion />
      ) : (
        <LoginForm
          siguiente={siguiente}
          enlaceFacebook={authFacebookHabilitado() ? rutaEntrarConFacebook(siguiente) : null}
          correo={correo}
          aviso={mensajeErrorFacebook(primer(searchParams.error), authFacebookHabilitado())}
        />
      )}
    </MarcoAcceso>
  )
}
