import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Datos de Facebook' }

export default function DatosFacebookPage() {
  return (
    <article className="contenedor max-w-2xl space-y-4 py-10">
      <h1 className="text-3xl">Datos recibidos de Facebook</h1>
      <p className="text-sm leading-relaxed text-ink-soft">
        Si entra con Facebook, guardamos el nombre y el correo que Facebook confirma. La cédula y el enlace público
        del perfil los escribe usted. Ese enlace es el que administración abre al revisar una reseña.
      </p>
      <p className="text-sm leading-relaxed text-ink-soft">
        Para quitar ese ingreso, retire La Protectora del Alquiler en la configuración de Facebook, en aplicaciones y
        sitios web. Facebook nos avisa con una solicitud firmada. Quitamos el ingreso con Facebook y, si era la única
        forma de entrar, dejamos la cuenta inactiva. Las reseñas publicadas siguen en el registro.
      </p>
      <p className="text-sm leading-relaxed text-ink-soft">
        El detalle está en la{' '}
        <Link href="/privacidad#eliminacion" className="font-semibold text-seal underline-offset-2 hover:underline">
          página de privacidad
        </Link>
        . Para desactivar una cuenta que también usa clave, pida a administración que lo haga en Administración →
        Usuarios.
      </p>
    </article>
  )
}
