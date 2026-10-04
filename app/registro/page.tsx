import { redirect } from 'next/navigation'
import { MarcoAcceso } from '@/components/marco-acceso'
import { destinoInterno, primer } from '@/lib/util'
import { RegistroForm } from '@/components/registro-form'
import { AvisoConfiguracion } from '@/components/aviso-configuracion'
import { obtenerUsuario, puedeConsultar } from '@/lib/dal'
import { altaFacebookPendiente } from '@/lib/facebook-alta'
import { authFacebookHabilitado, rutaAltaFacebook, rutaEntrarConFacebook } from '@/lib/facebook-auth'
import { sinSupabase } from '@/lib/supabase/server'
import Link from '@/components/enlace'
import { correoRecordado } from '@/lib/correo-recordado'

export const metadata = { title: 'Crear cuenta' }

export default async function RegistroPage(props: PageProps<'/registro'>) {
  const parametros = await props.searchParams
  const siguiente = destinoInterno(primer(parametros.siguiente), '/')
  const correo = correoRecordado(primer(parametros.correo))
  const desdeEjemplo = primer(parametros.origen) === 'ejemplo'
  if (!sinSupabase()) {
    const usuario = await obtenerUsuario()
    if (usuario) {
      if (usuario.rol === 'admin') redirect('/admin')
      if (await puedeConsultar(usuario)) redirect('/')
      redirect('/registro/resena')
    }
    if (await altaFacebookPendiente()) redirect(rutaAltaFacebook(siguiente))
  }
  return (
    <MarcoAcceso
      titulo="Crear una cuenta"
      texto="Para propietarios y agencias. Cree su cuenta, confirme su correo y comparta su primera reseña."
      pasoRegistro={1}
    >
      {sinSupabase() ? (
        <AvisoConfiguracion />
      ) : (
        <>
          {desdeEjemplo && (
            <p className="mb-4 text-sm" data-visita-publica="registro_desde_ejemplo">
              <Link href="/ejemplo" className="enlace-atras">← Volver a la consulta de ejemplo</Link>
            </p>
          )}
          <RegistroForm
            siguiente={siguiente}
            correo={correo}
            enlaceFacebook={authFacebookHabilitado() ? rutaEntrarConFacebook(siguiente) : null}
          />
        </>
      )}
    </MarcoAcceso>
  )
}
