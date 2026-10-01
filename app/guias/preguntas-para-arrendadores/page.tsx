import Link from '@/components/enlace'
import { GuiaPublica } from '@/components/guia-publica'
import { GUIA_PREGUNTAS } from '@/lib/guias'
import { metadataPublica } from '@/lib/seo'

export const metadata = metadataPublica({
  titulo: GUIA_PREGUNTAS.tituloSeo,
  descripcion: GUIA_PREGUNTAS.descripcion,
  ruta: GUIA_PREGUNTAS.ruta,
})

const preguntas = [
  {
    titulo: 'Relación y período',
    pregunta: '¿Qué relación tuvo usted con el alquiler y durante qué período?',
    seguimiento: 'Aclare si era propietario, administrador o intermediario, y qué partes de la relación conoció directamente.',
  },
  {
    titulo: 'Pagos acordados',
    pregunta: '¿Cómo se cumplieron las fechas de pago durante ese período?',
    seguimiento: 'Si menciona atrasos, pregunte cuántas veces ocurrieron, cuánto duraron y si quedaron resueltos.',
  },
  {
    titulo: 'Comunicación',
    pregunta: '¿Cómo se comunicaban cuando surgía una consulta o un inconveniente?',
    seguimiento: 'Pida un ejemplo concreto: un aviso de mantenimiento, una coordinación de visita o una dificultad con un pago.',
  },
  {
    titulo: 'Mantenimiento y cuidado',
    pregunta: '¿Qué observó sobre el cuidado de la propiedad y el reporte de problemas?',
    seguimiento: 'Aclare qué observó personalmente, cuándo lo observó y qué información tenía sobre el estado previo de la vivienda.',
  },
  {
    titulo: 'Acuerdos durante el alquiler',
    pregunta: '¿Hubo algún desacuerdo sobre lo que habían pactado? ¿Cómo lo abordaron?',
    seguimiento: 'Identifique el acuerdo concreto, las versiones que se conversaron y el resultado, sin asumir que todo desacuerdo fue un incumplimiento.',
  },
  {
    titulo: 'Salida y entrega',
    pregunta: 'Si el alquiler terminó, ¿cómo coordinaron la salida y la entrega de la propiedad?',
    seguimiento: 'Pregunte por la comunicación, la revisión del estado de la propiedad y los asuntos que ambas partes dejaron resueltos o pendientes.',
  },
  {
    titulo: 'Valoración final',
    pregunta: '¿Volvería a alquilarle y qué hechos de su experiencia explican esa respuesta?',
    seguimiento: 'Conserve tanto la opinión como los hechos que la acompañan. Una respuesta de sí o no, por sí sola, ofrece poco contexto.',
  },
]

export default function PreguntasArrendadoresPage() {
  return (
    <GuiaPublica guia={GUIA_PREGUNTAS}>
      <section id="antes-de-llamar" className="space-y-4">
        <h2>Prepare la conversación</h2>
        <p>
          Acuerde con la persona interesada el contacto de su arrendador anterior. Al llamar, preséntese,
          explique que está solicitando una referencia de alquiler y confirme que sea un buen momento.
          No hace falta convertir la conversación en un interrogatorio: seleccione las preguntas que
          correspondan y permita que la otra persona explique sus respuestas.
        </p>
        <p>
          Este guion está pensado para propietarios y agencias en Costa Rica. Use las mismas preguntas
          básicas en sus consultas para comparar información equivalente. Puede empezar con el{' '}
          <Link href="/guias/referencias-de-inquilinos#pedir-referencias" className="underline underline-offset-4">mensaje modelo para pedir una referencia</Link>.
        </p>
      </section>

      <section id="preguntas" className="space-y-5">
        <h2>Siete preguntas para un arrendador anterior</h2>
        <ol className="divide-y divide-line border-y border-line">
          {preguntas.map(({ titulo, pregunta, seguimiento }, indice) => (
            <li key={titulo} className="space-y-3 py-5">
              <h3 className="text-ink">{indice + 1}. {titulo}</h3>
              <p className="font-medium">{pregunta}</p>
              <p>{seguimiento}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="aclaraciones" className="space-y-4">
        <h2>Convierta una respuesta vaga en una pregunta concreta</h2>
        <p>
          Si escucha una etiqueta como «responsable» o «problemático», pregunte qué ocurrió para que
          la persona lo describa así. Evite sugerir la respuesta que espera recibir.
        </p>
        <dl className="space-y-5 rounded-xl border border-line bg-card p-5">
          <div className="space-y-1">
            <dt className="font-semibold">«Siempre hubo buena comunicación»</dt>
            <dd className="text-ink-soft">¿Puede contarme cómo coordinaban un reporte o una visita?</dd>
          </div>
          <div className="space-y-1">
            <dt className="font-semibold">«Dejó la casa mal»</dt>
            <dd className="text-ink-soft">¿Qué encontró durante la entrega y cómo lo comparó con el estado inicial?</dd>
          </div>
          <div className="space-y-1">
            <dt className="font-semibold">«Quedaron cosas pendientes»</dt>
            <dd className="text-ink-soft">¿Qué asuntos quedaron pendientes y sabe si se resolvieron después?</dd>
          </div>
        </dl>
        <p>
          Mantenga la conversación en hechos de la relación de alquiler. Los rumores sobre terceros,
          la vida íntima o las opiniones sobre características personales no aclaran cómo se desarrolló
          esa experiencia.
        </p>
      </section>

      <section id="plantilla" className="space-y-4">
        <h2>Plantilla para registrar la referencia</h2>
        <p>
          Copie estos campos a sus notas. Registre la fecha de la conversación y distinga lo relatado
          de lo que usted pudo comprobar. Si no hubo respuesta a una pregunta, déjelo indicado.
        </p>
        <div className="rounded-xl border border-line bg-card p-5">
          <ul className="list-disc space-y-3 pl-5">
            <li>Fecha de la conversación:</li>
            <li>Persona consultada y relación con el alquiler:</li>
            <li>Período aproximado del alquiler:</li>
            <li>Pagos: hechos relatados y aclaraciones:</li>
            <li>Comunicación: ejemplo descrito:</li>
            <li>Cuidado de la propiedad: observaciones y contexto:</li>
            <li>Salida o entrega: resultado y asuntos pendientes:</li>
            <li>Opinión del arrendador y hechos que la sustentan:</li>
            <li>Información que no se pudo confirmar:</li>
            <li>Aclaraciones por conversar con la persona interesada:</li>
          </ul>
        </div>
        <p>
          Guarde sus notas de forma privada y con acceso limitado. Este guion sirve para organizar una
          conversación; no convierte lo que otra persona contó en una reseña de una experiencia propia.
        </p>
      </section>

      <section id="cerrar-conversacion" className="space-y-4">
        <h2>Revise lo que entendió antes de terminar</h2>
        <p>
          Resuma brevemente los puntos principales y permita que el arrendador corrija cualquier
          malentendido. Agradezca su tiempo. Si una respuesta deja una duda relevante, anote la pregunta
          pendiente en lugar de darla por resuelta.
        </p>
        <p>
          Compare los relatos por su contenido y contexto, sin convertir una sola opinión en una certeza
          sobre el futuro. La{' '}
          <Link href="/guias/referencias-de-inquilinos#evaluar-respuestas" className="underline underline-offset-4">guía para evaluar referencias de inquilinos</Link>{' '}
          explica cómo ordenar versiones diferentes y cómo interpretar la ausencia de referencias.
        </p>
      </section>
    </GuiaPublica>
  )
}
