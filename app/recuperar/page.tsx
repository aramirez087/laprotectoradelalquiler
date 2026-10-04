import { MarcoAcceso } from '@/components/marco-acceso'
import { RecuperarForm } from '@/components/recuperar-form'
import { AvisoConfiguracion } from '@/components/aviso-configuracion'
import { sinSupabase } from '@/lib/supabase/server'
import { destinoInterno, primer } from '@/lib/util'
import { correoRecordado } from '@/lib/correo-recordado'

export const metadata = { title: 'Recuperar clave' }

export default async function RecuperarPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const parametros = await props.searchParams
  const enlaceVencido = primer(parametros.error) === 'enlace'
  const siguiente = destinoInterno(primer(parametros.siguiente), '/')
  const correo = correoRecordado(primer(parametros.correo))

  return (
    <MarcoAcceso titulo="Recuperar mi clave" texto="Use el correo de su cuenta, aunque se haya registrado en la versión anterior. Le enviaremos un enlace para elegir una clave nueva.">
      {enlaceVencido && <p role="alert" className="aviso aviso-error mb-4">El enlace venció o ya se usó. Escriba su correo para solicitar uno nuevo.</p>}
      {sinSupabase() ? <AvisoConfiguracion /> : <RecuperarForm correo={correo} siguiente={siguiente} />}
    </MarcoAcceso>
  )
}
