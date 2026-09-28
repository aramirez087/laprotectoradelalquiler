import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Datos de Facebook' }

export default function DatosFacebookPage() {
  return (
    <article className="contenedor max-w-2xl space-y-7">
      <Link href="/privacidad" className="enlace-atras">← Volver a privacidad</Link>
      <header>
        <p className="eyebrow mb-3">Privacidad y cuenta</p>
        <h1 className="text-3xl sm:text-4xl">Sus datos de Facebook</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">Qué recibimos al iniciar sesión y cómo puede quitar ese acceso.</p>
      </header>
      <section className="space-y-3 border-t border-line pt-6">
        <h2 className="text-xl">Qué datos guardamos</h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          Si entra con Facebook, guardamos el nombre y el correo que Facebook confirma. La cédula y el enlace público
          del perfil los escribe usted. Ese enlace es el que administración abre al revisar una reseña.
        </p>
      </section>
      <section className="space-y-3 border-t border-line pt-6">
        <h2 className="text-xl">Cómo quitar el ingreso con Facebook</h2>
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-ink-soft">
          <li>Abra la configuración de su cuenta de Facebook.</li>
          <li>Entre a «Aplicaciones y sitios web» y retire La Protectora del Alquiler.</li>
          <li>Facebook nos enviará la solicitud. Puede consultar el resultado en el enlace de confirmación que le entregue.</li>
        </ol>
        <p className="rounded-xl border border-line bg-card p-4 text-sm leading-relaxed text-ink-soft">
          Quitamos el ingreso con Facebook. Si era su única forma de entrar, la cuenta queda inactiva. <strong className="font-semibold text-ink">Las reseñas publicadas siguen en el registro.</strong>
        </p>
      </section>
      <section className="space-y-3 border-t border-line pt-6">
        <h2 className="text-xl">Si también usa una clave</h2>
        <p className="text-sm leading-relaxed text-ink-soft">Para desactivar su cuenta completa, solicítelo a administración. El equipo puede hacerlo desde la gestión de usuarios.</p>
      </section>
      <p className="text-sm leading-relaxed text-ink-soft">
        Puede consultar todos los detalles en la{' '}
        <Link href="/privacidad#eliminacion" className="font-semibold text-seal underline-offset-2 hover:underline">
          página de privacidad
        </Link>
        .
      </p>
    </article>
  )
}
