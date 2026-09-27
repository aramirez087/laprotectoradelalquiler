import { MarcoAcceso } from '@/components/marco-acceso'
import Link from 'next/link'
import { FormClave } from '@/components/form-clave'
import { AvisoConfiguracion } from '@/components/aviso-configuracion'
import { establecerClave } from '@/lib/actions/auth'
import { createClient, sinSupabase } from '@/lib/supabase/server'

export const metadata = { title: 'Nueva clave' }

export default async function RestablecerPage() {
  if (sinSupabase()) {
    return (
      <MarcoAcceso titulo="Elija una clave nueva" texto="Use al menos 8 caracteres, con letras y números.">
        <AvisoConfiguracion />
      </MarcoAcceso>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <MarcoAcceso titulo="Elija una clave nueva" texto="Use al menos 8 caracteres, con letras y números.">
      {user ? (
        <FormClave accion={establecerClave} etiqueta="Guardar clave" />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">El enlace venció o ya se usó.</p>
          <Link href="/recuperar" className="btn-primario inline-flex">
            Pedir otro
          </Link>
        </div>
      )}
    </MarcoAcceso>
  )
}
