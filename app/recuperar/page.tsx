import { MarcoAcceso } from '@/components/marco-acceso'
import { RecuperarForm } from '@/components/recuperar-form'
import { AvisoConfiguracion } from '@/components/aviso-configuracion'
import { sinSupabase } from '@/lib/supabase/server'
import { primer } from '@/lib/util'

export const metadata = { title: 'Recuperar clave' }

export default async function RecuperarPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const enlaceVencido = primer((await props.searchParams).error) === 'enlace'

  return (
    <MarcoAcceso titulo="Recupere su acceso" texto="Escriba el correo de su cuenta. Le enviaremos un enlace para crear una clave nueva.">
      {enlaceVencido && <p className="aviso aviso-error mb-4">El enlace venció o ya se usó. Pida otro.</p>}
      {sinSupabase() ? <AvisoConfiguracion /> : <RecuperarForm />}
    </MarcoAcceso>
  )
}
