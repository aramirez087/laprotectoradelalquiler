import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { MarcoAcceso } from '@/components/marco-acceso'
import { LoginForm } from '@/components/login-form'
import { destinoTrasLogin, obtenerUsuario } from '@/lib/dal'
import { AvisoConfiguracion } from '@/components/aviso-configuracion'
import { altaFacebookPendiente } from '@/lib/facebook-alta'
import { authFacebookHabilitado, mensajeErrorFacebook, rutaAltaFacebook, rutaEntrarConFacebook } from '@/lib/facebook-auth'
import { COOKIE_CORREO, correoRecordado } from '@/lib/correo-recordado'
import { sinSupabase } from '@/lib/supabase/server'
import { destinoInterno, primer } from '@/lib/util'

export const metadata = { title: 'Iniciar sesión' }

export default async function LoginPage(props: PageProps<'/login'>) {
  const searchParams = await props.searchParams
  const siguiente = destinoInterno(primer(searchParams.siguiente), '/')
  const correo = correoRecordado((await cookies()).get(COOKIE_CORREO)?.value)
  if (!sinSupabase()) {
    const usuario = await obtenerUsuario()
    if (usuario) {
      redirect(usuario.auth_user_id ? await destinoTrasLogin(usuario.auth_user_id, siguiente) : siguiente)
    }
    if (await altaFacebookPendiente()) redirect(rutaAltaFacebook(siguiente))
  }

  return (
    <MarcoAcceso
      titulo="Iniciar sesión"
      texto={
        siguiente.startsWith('/resenas/nueva')
          ? 'Inicie sesión para compartir su experiencia de alquiler.'
          : 'Entre con su correo y clave. Con su acceso vigente, irá directamente a consultas.'
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
