import Link from '@/components/enlace'
import { GuiaPublica } from '@/components/guia-publica'
import { GUIA_REFERENCIAS } from '@/lib/guias'
import { metadataPublica } from '@/lib/seo'

export const metadata = metadataPublica({
  titulo: GUIA_REFERENCIAS.tituloSeo,
  descripcion: GUIA_REFERENCIAS.descripcion,
  ruta: GUIA_REFERENCIAS.ruta,
})

export default function ReferenciasInquilinosPage() {
  return (
    <GuiaPublica guia={GUIA_REFERENCIAS}>
      <p>
        Una referencia de alquiler es el relato de alguien que tuvo una relación de arrendamiento con
        la persona interesada en su propiedad. Para que resulte útil, necesita más que un «sí, lo recomiendo»:
        conviene conocer el período, los acuerdos y los hechos que sustentan esa opinión.
      </p>

      <section id="pedir-referencias" className="space-y-4">
        <h2>1. Explique qué necesita y para qué</h2>
        <p>
          Pida a la persona interesada el contacto de un arrendador anterior y las fechas aproximadas
          del alquiler. Explíquele que desea conversar sobre esa experiencia y acuerde el contacto antes
          de llamar. Puede usar este mensaje como punto de partida y adaptarlo a su proceso.
        </p>
        <div className="space-y-3 rounded-xl border border-line bg-card p-5">
          <h3>Mensaje modelo</h3>
          <blockquote className="border-l-2 border-seal/40 pl-4">
            <p>
              Para conocer sus experiencias de alquiler anteriores, ¿podría compartir el nombre y
              contacto de un arrendador, junto con el período aproximado en que le alquiló? Me gustaría
              conversar sobre pagos, comunicación y entrega de la propiedad. Confírmeme si podemos
              contactarlo y si ya está al tanto. Si es su primer alquiler, puede indicármelo.
            </p>
          </blockquote>
        </div>
        <p>
          Solicite solo la información necesaria para esa conversación. Evite reunir datos de familiares
          u otras personas que no participaron en el alquiler.
        </p>
      </section>

      <section id="confirmar-contexto" className="space-y-4">
        <h2>2. Confirme el contexto de la referencia</h2>
        <p>
          Al comenzar, identifíquese y explique el motivo de la llamada. Confirme quién responde, qué
          relación tuvo con el alquiler y durante qué período. Un propietario que administró la relación
          directamente puede describir aspectos distintos de los que conoce un intermediario.
        </p>
        <ul className="list-disc space-y-3 pl-5">
          <li><strong>Período:</strong> ¿cuándo comenzó y terminó el alquiler, o sigue vigente?</li>
          <li><strong>Participación:</strong> ¿recibía los pagos, atendía reportes o participó en la entrega?</li>
          <li><strong>Hechos:</strong> ¿qué ocurrió con los pagos, la comunicación y el cuidado de la propiedad?</li>
          <li><strong>Resultado:</strong> si hubo una dificultad, ¿cómo se resolvió y qué quedó pendiente?</li>
        </ul>
        <p>
          Si las fechas o la relación descrita no coinciden, registre la diferencia y pida una aclaración.
          No complete lo que falta con suposiciones. Para preparar la llamada, use el{' '}
          <Link href="/guias/preguntas-para-arrendadores" className="underline underline-offset-4">guion de preguntas para un arrendador anterior</Link>.
        </p>
      </section>

      <section id="evaluar-respuestas" className="space-y-4">
        <h2>3. Distinga los hechos de las conclusiones</h2>
        <p>
          Anote por separado lo que la persona cuenta que ocurrió y la valoración que hace de ello.
          «Fue excelente» expresa una opinión. «Durante el año de alquiler recibí los pagos en la fecha
          acordada» describe la experiencia que sostiene esa opinión.
        </p>
        <div className="space-y-3 rounded-xl bg-seal-soft p-5">
          <h3>Ejemplo ficticio de una aclaración</h3>
          <p>
            Si una referencia dice «se atrasaba», pregunte en cuántas ocasiones, por cuánto tiempo y
            si esos pagos se resolvieron. Un retraso puntual comunicado y resuelto describe una situación
            distinta de varios pagos que siguen pendientes. Registre lo que le respondan sin atribuir
            intenciones.
          </p>
        </div>
        <p>
          Si otra fuente ofrece una versión diferente, identifique el punto concreto de desacuerdo y
          pida contexto a la persona interesada. Una referencia antigua o una experiencia aislada no
          permite conocer por sí sola cómo será un alquiler nuevo.
        </p>
        <p>
          Las reseñas de una plataforma pueden complementar estas conversaciones. Confirme primero
          que la ficha corresponde a la persona que consulta y lea cada relato completo. En La Protectora,
          la aprobación de una reseña no garantiza pagos ni el resultado de un nuevo alquiler. Consulte{' '}
          <Link href="/como-funciona" className="underline underline-offset-4">cómo funciona el acceso y la revisión de reseñas</Link>.
        </p>
      </section>

      <section id="sin-referencias" className="space-y-4">
        <h2>Si no hay referencias o nadie responde</h2>
        <p>
          Pregunte si se trata de un primer alquiler o si existe otra experiencia anterior que la persona
          pueda explicar. Cuando un contacto no responde, anote «no fue posible contactar»; eso no equivale
          a una referencia negativa.
        </p>
        <p>
          Si no encuentra reseñas en La Protectora, lo único que sabe es que su consulta no mostró relatos
          disponibles. No interprete ese resultado como una aprobación ni como una señal de incumplimiento.
          Mantenga las preguntas centradas en la experiencia de alquiler y aplique criterios consistentes.
        </p>
      </section>

      <section id="lista-verificacion" className="space-y-4">
        <h2>Lista de verificación antes de cerrar la consulta</h2>
        <p>Puede copiar esta lista a sus notas y marcar lo que ya aclaró:</p>
        <ul className="list-disc space-y-3 pl-5">
          <li>Expliqué a la persona interesada el propósito de solicitar referencias.</li>
          <li>Confirmé el período de alquiler y la participación de quien dio la referencia.</li>
          <li>Pregunté por hechos concretos y por el resultado de cualquier dificultad.</li>
          <li>Separé las opiniones, los hechos relatados y lo que no se pudo confirmar.</li>
          <li>Pedí aclaraciones cuando encontré versiones diferentes.</li>
          <li>Registré las dudas pendientes sin convertirlas en conclusiones.</li>
        </ul>
      </section>
    </GuiaPublica>
  )
}
