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
    <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center px-4">
      <h1 className="mb-2 text-2xl">Recuperar clave</h1>
      <p className="mb-6 text-sm text-ink-soft">Escriba su correo. Si tiene cuenta, le llega un enlace.</p>
      {enlaceVencido && <p className="aviso aviso-error mb-4">El enlace venció o ya se usó. Pida otro.</p>}
      {sinSupabase() ? <AvisoConfiguracion /> : <RecuperarForm />}
    </div>
  )
}
