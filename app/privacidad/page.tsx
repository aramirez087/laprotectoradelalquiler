import Link from '@/components/enlace'
import { JsonLd } from '@/components/json-ld'
import { datosPagina, metadataPublica } from '@/lib/seo'

const descripcion = 'Conozca qué datos guarda La Protectora del Alquiler, quién puede consultar las reseñas de inquilinos y cómo se protege la cédula en el registro de Costa Rica.'
export const metadata = metadataPublica({
  titulo: 'Privacidad de datos | La Protectora del Alquiler',
  descripcion,
  ruta: '/privacidad',
})

export default function PrivacidadPage() {
  return (
    <article className="contenedor max-w-2xl space-y-8 py-10">
      <JsonLd datos={datosPagina('/privacidad', 'Privacidad', descripcion)} />
      <Link href="/" className="enlace-atras">← Volver al inicio</Link>
      <header className="space-y-3">
        <p className="eyebrow">Su información</p>
        <h1 className="text-3xl sm:text-4xl">Privacidad</h1>
        <p className="text-sm leading-relaxed text-ink-soft">
          La Protectora del Alquiler es un registro para propietarios y agencias en Costa Rica que comparten
          experiencias sobre sus inquilinos. Esta página describe los datos que guarda el sitio y quién puede verlos.
        </p>
        <p className="text-xs text-ink-soft">Actualizado el 30 de septiembre de 2026</p>
      </header>

      <nav aria-label="En esta página" className="rounded-2xl border border-line bg-card p-5">
        <p className="mb-2 text-sm font-semibold">En esta página</p>
        <ul className="grid gap-x-5 sm:grid-cols-2">
          {[
            ['cuenta', 'Su cuenta'],
            ['facebook', 'Ingreso con Facebook'],
            ['resenas', 'Reseñas y cédula'],
            ['visibilidad', 'Quién ve sus datos'],
            ['audiencia', 'Estadísticas de audiencia'],
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
        <p className="text-sm leading-relaxed text-ink-soft">
          Para completar el nombre consultamos la cédula en una copia privada del padrón electoral mensual del TSE.
          Conservamos únicamente cédula, nombres y apellidos de esa fuente. Administración ve la coincidencia,
          la fecha del padrón y cualquier diferencia con el nombre registrado. Esta consulta confirma un registro
          en el padrón; la identidad de quien presenta el número requiere revisión.
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
          La reseña guarda el relato y la persona de quien se habla. Si la marca anónima, otros usuarios no ven su nombre.
          La cédula completa no se publica: en el registro se muestra enmascarada. Administración ve la cuenta, la
          cédula y el enlace de Facebook al revisar. Consultar reseñas de otras personas requiere una cuenta activa
          y un permiso de consulta vigente. Su primera reseña aprobada activa 3 meses de consultas.
          Las fichas y las reseñas no son páginas públicas para buscadores.
        </p>
        <p className="text-sm leading-relaxed text-ink-soft">
          Al modificar una reseña conservamos las versiones anteriores del relato, su opción de anonimato,
          estado y notas de moderación. Este historial solo puede consultarlo el autor activo y administración;
          no aparece en las fichas que leen otros miembros. Se elimina al borrar la reseña.
        </p>
      </section>

      <section id="visibilidad" className="space-y-3">
        <h2 className="text-xl">Quién más los ve</h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          Los usa la administración del sitio para revisar reseñas y cuentas. No los vendemos ni los usamos para
          publicidad. Para medir el uso del sitio utilizamos Statsig, como se explica a continuación.
        </p>
      </section>

      <section id="borradores" className="space-y-3">
        <h2 className="text-xl">Borradores y avisos de revisión</h2>
        <p className="text-sm leading-relaxed text-ink-soft">Mientras escribe una nueva reseña, guardamos un borrador privado en su cuenta para que pueda retomarlo en otro dispositivo. El formulario confirma cada guardado. No se guarda el relato ni la cédula en el almacenamiento del navegador. El borrador vence a los 30 días del último guardado y se elimina su contenido al enviar la reseña.</p>
        <p className="text-sm leading-relaxed text-ink-soft">Las aprobaciones, solicitudes de corrección y rechazos generan un aviso por correo mediante Resend. El aviso incluye el número de reseña y un enlace a su perfil; no incluye la identidad del inquilino, el relato ni la nota de moderación. Conservamos los datos necesarios para confirmar o reintentar el envío. Las copias de los avisos completados se eliminan a los 30 días.</p>
      </section>

      <section id="audiencia" className="space-y-3">
        <h2 className="text-xl">Estadísticas de audiencia</h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          Statsig recibe eventos de visita con categorías de páginas, origen de entrada y tipo de dispositivo.
          Usamos un identificador aleatorio guardado en su navegador para estimar visitantes distintos; no lo
          vinculamos con su cuenta. La medición no crea cookies de audiencia. Statsig también procesa datos
          técnicos de la conexión, como la dirección IP. Puede consultar su{' '}
          <a href="https://www.statsig.com/privacy" className="enlace-texto">política de privacidad</a>.
        </p>
        <p className="text-sm leading-relaxed text-ink-soft">
          No enviamos nombres, correos, cédulas, búsquedas, identificadores de fichas ni contenido de reseñas
          o formularios. No grabamos la pantalla ni las sesiones. Excluimos las visitas de administración y
          respetamos las señales de «No rastrear» y Global Privacy Control del navegador. Los informes
          agregados solo están disponibles para administración.
        </p>
      </section>

      <section id="activacion" className="space-y-3">
        <h2 className="text-xl">Estadísticas de activación</h2>
        <p className="text-sm leading-relaxed text-ink-soft">Dentro de nuestra base de datos registramos cuándo se crea una cuenta nueva, cuándo envía su primera reseña, cuándo obtiene su primera aprobación y cuándo completa su primera búsqueda. Estos hitos se vinculan con su cuenta para contarlos una sola vez y se eliminan al borrar la cuenta. No guardamos el texto de la búsqueda ni los resultados en estos hitos y no los enviamos a Statsig. El registro de la primera búsqueda respeta «No rastrear» y Global Privacy Control.</p>
        <p className="text-sm leading-relaxed text-ink-soft">Administración ve únicamente los conteos por cohorte y los tiempos de revisión agregados. Estas cifras ayudan a mejorar el registro y la moderación; no se usan para publicidad.</p>
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
