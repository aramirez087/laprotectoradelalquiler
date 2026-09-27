import { MarcoAcceso } from '@/components/marco-acceso'
import { destinoInterno, primer } from '@/lib/util'
import { RegistroForm } from '@/components/registro-form'
import { AvisoConfiguracion } from '@/components/aviso-configuracion'
import { sinSupabase } from '@/lib/supabase/server'

export const metadata = { title: 'Crear cuenta' }

export default async function RegistroPage(props: PageProps<'/registro'>) {
  const siguiente = destinoInterno(primer((await props.searchParams).siguiente))
  return (
    <MarcoAcceso
      titulo="Sea parte de la comunidad"
      texto="Cree su cuenta, comparta una experiencia de alquiler y acceda a las fichas cuando su reseña sea aprobada."
    >
      {sinSupabase() ? <AvisoConfiguracion /> : <RegistroForm siguiente={siguiente} />}
    </MarcoAcceso>
  )
}
