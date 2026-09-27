import Link from 'next/link'
import { FormClave } from '@/components/form-clave'
import { AvisoConfiguracion } from '@/components/aviso-configuracion'
import { establecerClave } from '@/lib/actions/auth'
import { createClient, sinSupabase } from '@/lib/supabase/server'

export const metadata = { title: 'Nueva clave' }

export default async function RestablecerPage() {
  if (sinSupabase()) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center px-4">
        <AvisoConfiguracion />
      </div>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl">Nueva clave</h1>
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
    </div>
  )
}
