import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacidad',
  description:
    'Qué datos guarda La Protectora del Alquiler, quién puede verlos y cómo se elimina el ingreso con Facebook.',
}

export default function PrivacidadPage() {
  return (
    <article className="contenedor max-w-2xl space-y-8 py-10">
      <Link href="/" className="enlace-atras">← Volver al inicio</Link>
      <header className="space-y-3">
        <p className="eyebrow">Su información</p>
        <h1 className="text-3xl sm:text-4xl">Privacidad</h1>
        <p className="text-sm leading-relaxed text-ink-soft">
          La Protectora del Alquiler es un registro para propietarios y agencias en Costa Rica que comparten
          experiencias sobre sus inquilinos. Esta página describe los datos que guarda el sitio y quién puede verlos.
        </p>
        <p className="text-xs text-ink-soft">Actualizado el 28 de septiembre de 2026</p>
      </header>

      <nav aria-label="En esta página" className="rounded-2xl border border-line bg-card p-5">
        <p className="mb-2 text-sm font-semibold">En esta página</p>
        <ul className="grid gap-x-5 sm:grid-cols-2">
          {[
            ['cuenta', 'Su cuenta'],
            ['facebook', 'Ingreso con Facebook'],
            ['resenas', 'Reseñas y cédula'],
            ['visibilidad', 'Quién ve sus datos'],
            ['eliminacion', 'Eliminar el ingreso con Facebook'],
          ].map(([id, texto]) => (
            <li key={id}><a href={`#${id}`} className="enlace-texto">{texto}</a></li>
          ))}
        </ul>
      </nav>

      <section id="cuenta" className="space-y-3">
        <h2 className="text-xl">Cuenta</h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          Para crear una cuenta pedimos el nombre, el correo, la cédula, el rol (propietario o agencia) y
          el enlace público del perfil de Facebook. Si entra con correo y clave, la clave la guarda el servicio de
          acceso, no esta base en texto legible. La sesión usa una cookie de ese servicio.
        </p>
      </section>

      <section id="facebook" className="space-y-3">
        <h2 className="text-xl">Facebook</h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          Si entra con Facebook, recibimos el nombre y, cuando Facebook lo entrega, el correo. La cédula, el rol y el
          enlace público del perfil los escribe usted: Facebook no nos da ese enlace. El identificador de acceso de
          Facebook queda en el servicio de acceso. El enlace público queda en el registro, para que administración lo
          abra al revisar una reseña.
        </p>
      </section>

      <section id="resenas" className="space-y-3">
        <h2 className="text-xl">Reseñas y cédula</h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          La reseña guarda el relato y la persona de quien se habla. Si la marca anónima, el público no ve su nombre.
          La cédula completa no se publica: en el registro se muestra enmascarada. Administración ve la cuenta, la
          cédula y el enlace de Facebook al revisar. Consultar reseñas de otras personas se abre cuando administración
          aprueba una reseña suya.
        </p>
      </section>

      <section id="visibilidad" className="space-y-3">
        <h2 className="text-xl">Quién más los ve</h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          Los usa la administración del sitio para revisar reseñas y cuentas. No los vendemos ni los usamos para
          publicidad. El sitio no incluye medidores de audiencia de terceros.
        </p>
      </section>

      <section id="eliminacion" className="space-y-2">
        <h2 className="text-xl">Eliminar el ingreso con Facebook</h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          En Facebook puede quitar La Protectora del Alquiler de sus aplicaciones. Facebook nos envía entonces una
          solicitud firmada. Si encontramos la cuenta, quitamos el ingreso con Facebook y el enlace público guardado.
          Si esa era la única forma de entrar, la cuenta queda inactiva y borramos el correo de acceso. Las reseñas
          ya publicadas siguen en el registro; si no eran anónimas, el nombre con el que se firmaron también.
        </p>
        <p className="text-sm leading-relaxed text-ink-soft">
          El resultado queda en una página con un código de confirmación. Las instrucciones cortas están en{' '}
          <Link href="/auth/facebook/datos" className="font-semibold text-seal underline-offset-2 hover:underline">
            datos de Facebook
          </Link>
          .
        </p>
        <p className="text-sm leading-relaxed text-ink-soft">
          Para cerrar una cuenta que también entra con clave, inicie sesión y pida a administración que la desactive
          en Administración → Usuarios.
        </p>
      </section>
    </article>
  )
}
