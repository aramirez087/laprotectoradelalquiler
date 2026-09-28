import { redirect } from 'next/navigation'
import { MarcoAcceso } from '@/components/marco-acceso'
import { destinoInterno, primer } from '@/lib/util'
import { RegistroForm } from '@/components/registro-form'
import { AvisoConfiguracion } from '@/components/aviso-configuracion'
import { obtenerUsuario } from '@/lib/dal'
import { altaFacebookPendiente } from '@/lib/facebook-alta'
import { authFacebookHabilitado, rutaAltaFacebook, rutaEntrarConFacebook } from '@/lib/facebook-auth'
import { sinSupabase } from '@/lib/supabase/server'

export const metadata = { title: 'Crear cuenta' }

export default async function RegistroPage(props: PageProps<'/registro'>) {
  const siguiente = destinoInterno(primer((await props.searchParams).siguiente))
  if (!sinSupabase()) {
    const usuario = await obtenerUsuario()
    if (usuario) redirect('/registro/resena')
    if (await altaFacebookPendiente()) redirect(rutaAltaFacebook(siguiente))
  }
  return (
    <MarcoAcceso
      titulo="Sea parte de la comunidad"
      texto="Paso 1 de 2. Indique su cédula y su perfil de Facebook. En el siguiente paso escribirá una reseña. Administración la aprueba antes de abrir la consulta."
    >
      {sinSupabase() ? (
        <AvisoConfiguracion />
      ) : (
        <RegistroForm
          siguiente={siguiente}
          enlaceFacebook={authFacebookHabilitado() ? rutaEntrarConFacebook(siguiente) : null}
        />
      )}
    </MarcoAcceso>
  )
}
