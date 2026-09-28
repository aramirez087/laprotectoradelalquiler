import type { Metadata } from 'next'
import Link from 'next/link'
import { estadoEliminacionFacebook } from '@/lib/facebook-eliminacion-servidor'
import { codigoEliminacionValido } from '@/lib/facebook-eliminacion'
import { fechaCorta, primer } from '@/lib/util'

export const metadata: Metadata = { title: 'Eliminación de Facebook' }

export default async function EstadoEliminacionPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const codigo = primer((await props.searchParams).codigo)
  const valida = codigoEliminacionValido(codigo)
  const fila = valida ? await estadoEliminacionFacebook(codigo) : null

  return (
    <article className="contenedor max-w-2xl space-y-4 py-10">
      <h1 className="text-3xl">Eliminación de Facebook</h1>
      {!valida && (
        <p className="text-sm leading-relaxed text-ink-soft">
          Facebook envía la solicitud cuando alguien quita la aplicación desde su cuenta de Facebook. Esta página
          confirma el resultado con el código que Facebook recibe.
        </p>
      )}
      {valida && !fila && (
        <p className="text-sm leading-relaxed text-ink-soft">No encontramos esa solicitud.</p>
      )}
      {fila?.estado === 'completada' && (
        <p className="text-sm leading-relaxed text-ink-soft">
          Listo{fila.creado_en ? `, el ${fechaCorta(fila.creado_en)}` : ''}. Quitamos el ingreso con Facebook de esa
          cuenta. Si era la única forma de entrar, la cuenta quedó inactiva. Las reseñas publicadas siguen en el
          registro.
        </p>
      )}
      {fila?.estado === 'sin_cuenta' && (
        <p className="text-sm leading-relaxed text-ink-soft">
          Recibimos la solicitud{fila.creado_en ? ` el ${fechaCorta(fila.creado_en)}` : ''}. No había una cuenta
          vinculada a ese Facebook.
        </p>
      )}
      <p className="text-sm">
        <Link href="/privacidad#eliminacion" className="font-semibold text-seal underline-offset-2 hover:underline">
          Cómo tratamos esos datos
        </Link>
      </p>
    </article>
  )
}
