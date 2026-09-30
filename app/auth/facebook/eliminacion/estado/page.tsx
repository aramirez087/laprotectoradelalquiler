import type { Metadata } from 'next'
import Link from '@/components/enlace'
import { estadoEliminacionFacebook } from '@/lib/facebook-eliminacion-servidor'
import { codigoEliminacionValido } from '@/lib/facebook-eliminacion'
import { fechaCorta, primer } from '@/lib/util'
import { MarcoAcceso } from '@/components/marco-acceso'

export const metadata: Metadata = { title: 'Eliminación de Facebook' }

export default async function EstadoEliminacionPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const codigo = primer((await props.searchParams).codigo)
  const valida = codigoEliminacionValido(codigo)
  const fila = valida ? await estadoEliminacionFacebook(codigo) : null

  return (
    <MarcoAcceso titulo="Su solicitud de Facebook" texto="Aquí puede consultar el resultado de la solicitud para quitar el ingreso con Facebook.">
      {!valida && (
        <p className="text-sm leading-relaxed text-ink-soft">
          Facebook envía la solicitud cuando alguien quita la aplicación desde su cuenta de Facebook. Esta página
          confirma el resultado con el código que Facebook recibe.
        </p>
      )}
      {valida && !fila && (
        <p role="status" className="aviso aviso-error">No encontramos esa solicitud. Revise que abrió el enlace completo que le entregó Facebook.</p>
      )}
      {fila?.estado === 'completada' && (
        <p role="status" className="aviso aviso-ok">
          Listo{fila.creado_en ? `, el ${fechaCorta(fila.creado_en)}` : ''}. Quitamos el ingreso con Facebook de esa
          cuenta. Si era la única forma de entrar, la cuenta quedó inactiva. Las reseñas publicadas siguen en el
          registro.
        </p>
      )}
      {fila?.estado === 'sin_cuenta' && (
        <p role="status" className="aviso aviso-ok">
          Recibimos la solicitud{fila.creado_en ? ` el ${fechaCorta(fila.creado_en)}` : ''}. No había una cuenta
          vinculada a ese Facebook.
        </p>
      )}
      <p className="mt-6 text-sm">
        <Link href="/auth/facebook/datos" className="btn-secundario w-full">
          Cómo gestionar sus datos de Facebook
        </Link>
      </p>
    </MarcoAcceso>
  )
}
