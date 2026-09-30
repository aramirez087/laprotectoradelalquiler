import Link from 'next/link'
import { PreguntasFrecuentes } from '@/components/contenido-seo'
import { JsonLd } from '@/components/json-ld'
import { REGLAS_CONSULTA } from '@/lib/acceso-consulta'
import { datosPagina, metadataPublica } from '@/lib/seo'

const descripcion = 'Conozca cómo compartir experiencias y consultar reseñas de inquilinos en Costa Rica: registro, revisión, acceso por 3 meses y privacidad de los datos.'

export const metadata = metadataPublica({
  titulo: 'Cómo consultar reseñas de inquilinos | La Protectora',
  descripcion,
  ruta: '/como-funciona',
})

export default function ComoFuncionaPage() {
  return (
    <article className="contenedor max-w-3xl space-y-10 py-10 sm:space-y-12">
      <JsonLd datos={datosPagina('/como-funciona', 'Cómo funciona', descripcion)} />
      <nav aria-label="Ruta de navegación" className="flex flex-wrap items-center gap-x-2 text-sm text-ink-soft">
        <Link href="/" className="enlace-atras">Inicio</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Cómo funciona</span>
      </nav>

      <header className="space-y-4">
        <p className="eyebrow">Propietarios y agencias · Costa Rica</p>
        <h1 className="text-3xl sm:text-4xl">Cómo consultar reseñas de inquilinos antes de alquilar</h1>
        <p className="text-base leading-relaxed text-ink-soft">
          La Protectora del Alquiler es una plataforma donde propietarios y agencias en Costa Rica
          comparten experiencias con sus inquilinos. Los miembros con acceso vigente pueden buscar una
          persona y leer los relatos publicados por otros usuarios.
        </p>
        <p className="text-sm leading-relaxed text-ink-soft">
          La comunidad se construye con aportes: su primera reseña aprobada le da 3 meses de consultas gratis.
          Conozca los pasos, las reglas del acceso y cómo se cuida la información.
        </p>
      </header>

      <nav aria-label="En esta página" className="rounded-2xl border border-line bg-card p-5">
        <ul className="grid gap-x-5 sm:grid-cols-2">
          <li><a href="#registro-y-resena" className="enlace-texto">Registro y primera reseña</a></li>
          <li><a href="#acceso-consultas" className="enlace-texto">Permiso de consulta</a></li>
          <li><a href="#evaluar-inquilino" className="enlace-texto">Consultar antes de alquilar</a></li>
          <li><a href="#revision-y-privacidad" className="enlace-texto">Revisión y privacidad</a></li>
          <li><a href="#preguntas-frecuentes" className="enlace-texto">Preguntas frecuentes</a></li>
        </ul>
      </nav>

      <section id="registro-y-resena" className="space-y-6">
        <h2 className="text-2xl sm:text-3xl">Cree su cuenta y comparta su primera experiencia</h2>
        <ol className="space-y-6">
          <li className="space-y-2">
            <h3 className="text-lg">1. Regístrese como propietario o agencia</h3>
            <p className="text-sm leading-relaxed text-ink-soft">
              El registro solicita su nombre, cédula, correo, tipo de cuenta y perfil de Facebook.
              Si crea la cuenta con correo y clave, confirme su correo para continuar.
              Estos datos permiten identificar su cuenta y revisar su experiencia.
            </p>
          </li>
          <li className="space-y-2">
            <h3 className="text-lg">2. Identifique al inquilino y cuente qué ocurrió</h3>
            <p className="text-sm leading-relaxed text-ink-soft">
              Escriba el nombre y la cédula del inquilino, junto con un relato de su experiencia de alquiler.
              Revise los datos para evitar confundir a personas con nombres similares. Puede compartir
              una experiencia positiva o negativa y elegir si su nombre se muestra a otros usuarios.
            </p>
          </li>
          <li className="space-y-2">
            <h3 className="text-lg">3. Espere la revisión de administración</h3>
            <p className="text-sm leading-relaxed text-ink-soft">
              La reseña se envía a revisión antes de publicarse. En su perfil puede ver su estado y,
              si no se aprueba, el motivo indicado por administración. Crear la cuenta o enviar una reseña
              todavía no activa la consulta de experiencias de otros usuarios.
            </p>
          </li>
        </ol>
        <Link href="/registro" className="btn-primario">Crear mi cuenta y compartir una experiencia</Link>
      </section>

      <section id="acceso-consultas" className="space-y-4">
        <h2 className="text-2xl sm:text-3xl">Cómo funciona el permiso de consulta</h2>
        <p className="rounded-xl border border-seal/20 bg-seal-soft p-5 text-sm leading-relaxed text-seal">
          {REGLAS_CONSULTA}
        </p>
        <p className="text-sm leading-relaxed text-ink-soft">
          El plazo empieza cuando se aprueba la reseña. Si ya tiene permiso, se suma al tiempo vigente;
          si venció, una primera aprobación sobre otro inquilino inicia un nuevo período de 3 meses.
          Puede revisar la fecha de vencimiento en su perfil.
        </p>
        <p className="text-sm leading-relaxed text-ink-soft">
          Solo cuentan los aportes que conservan una reseña publicada. Si una reseña que otorgaba acceso
          se retira, el permiso se recalcula. Cuando su acceso vence, puede seguir viendo sus propias
          reseñas y compartir una experiencia con otro inquilino para enviarla a revisión.
        </p>
      </section>

      <section id="evaluar-inquilino" className="space-y-4">
        <h2 className="text-2xl sm:text-3xl">Información para evaluar a un inquilino antes de alquilar</h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          Con su cuenta activa y permiso vigente, inicie sesión y busque por nombre o cédula.
          Compruebe que la ficha corresponde a la persona que desea consultar y lea las experiencias
          publicadas. Los relatos pueden aportar contexto sobre alquileres anteriores de esa persona.
        </p>
        <p className="text-sm leading-relaxed text-ink-soft">
          Considere cada reseña como la experiencia de su autor. La revisión de administración no garantiza
          pagos, el cuidado de una propiedad ni el resultado de un nuevo alquiler. La ausencia de reseñas
          tampoco constituye una recomendación. Use esta información como complemento de su propia evaluación.
        </p>
        <Link href="/login" className="enlace-texto">Iniciar sesión para consultar reseñas →</Link>
      </section>

      <section id="revision-y-privacidad" className="space-y-4">
        <h2 className="text-2xl sm:text-3xl">Revisión de las experiencias y privacidad</h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          Las reseñas que envían propietarios y agencias pasan por administración antes de publicarse.
          Describa hechos de su experiencia de alquiler, escriba con respeto y evite datos personales
          innecesarios en el relato. Los usuarios pueden denunciar una reseña desde su ficha para que
          administración la revise.
        </p>
        <p className="text-sm leading-relaxed text-ink-soft">
          Consultar fichas y reseñas requiere iniciar sesión y tener permiso. Las identidades de inquilinos
          no se presentan como páginas públicas para buscadores. En las fichas, la cédula se muestra
          enmascarada a otros usuarios; el autor de la reseña y administración tienen permisos adicionales.
          Si marca su reseña como anónima, otros usuarios no ven su nombre, pero administración puede
          identificar su cuenta durante la revisión.
        </p>
        <Link href="/privacidad" className="enlace-texto">Lea la política de privacidad y el uso de sus datos →</Link>
      </section>

      <PreguntasFrecuentes />

      <section className="space-y-4 border-t border-line pt-8">
        <h2 className="text-2xl">Su experiencia puede ayudar a otro propietario</h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          Comparta lo que vivió al alquilar su propiedad y contribuya a que otros propietarios y agencias
          en Costa Rica tomen decisiones con más información.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/registro" className="btn-primario">Registrarme como propietario o agencia</Link>
          <Link href="/" className="btn-secundario">Volver a La Protectora del Alquiler</Link>
        </div>
      </section>
    </article>
  )
}
