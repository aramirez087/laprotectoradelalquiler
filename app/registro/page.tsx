import { redirect } from 'next/navigation'
import { MarcoAcceso } from '@/components/marco-acceso'
import { destinoInterno, primer } from '@/lib/util'
import { RegistroForm } from '@/components/registro-form'
import { AvisoConfiguracion } from '@/components/aviso-configuracion'
import { obtenerUsuario } from '@/lib/dal'
import { altaFacebookPendiente } from '@/lib/facebook-alta'
import { authFacebookHabilitado, rutaAltaFacebook, rutaEntrarConFacebook } from '@/lib/facebook-auth'
import { sinSupabase } from '@/lib/supabase/server'

export const metadata = { title: 'Registrarse' }

export default async function RegistroPage(props: PageProps<'/registro'>) {
  const siguiente = destinoInterno(primer((await props.searchParams).siguiente))
  if (!sinSupabase()) {
    const usuario = await obtenerUsuario()
    if (usuario) redirect(usuario.rol === 'admin' ? '/admin' : '/registro/resena')
    if (await altaFacebookPendiente()) redirect(rutaAltaFacebook(siguiente))
  }
  return (
    <MarcoAcceso
      titulo="Cree su cuenta"
      texto="Registro exclusivo para propietarios y agencias. Cree su cuenta y después escriba su primera reseña."
      pasoRegistro={1}
    >
      {sinSupabase() ? (
        <AvisoConfiguracion />
      ) : (
        <>
          <p className="mb-6 rounded-xl border border-seal/20 bg-seal-soft px-4 py-3 text-sm leading-relaxed text-seal">
            Su primera experiencia aprobada le da <strong className="font-semibold">3 meses para consultar reseñas</strong>. El acceso empieza cuando administración la aprueba.
          </p>
          <RegistroForm
            siguiente={siguiente}
            enlaceFacebook={authFacebookHabilitado() ? rutaEntrarConFacebook(siguiente) : null}
          />
        </>
      )}
    </MarcoAcceso>
  )
}
