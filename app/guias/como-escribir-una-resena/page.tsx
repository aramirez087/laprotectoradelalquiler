import Link from '@/components/enlace'
import { GuiaPublica } from '@/components/guia-publica'
import { GUIA_RESENA } from '@/lib/guias'
import { metadataPublica } from '@/lib/seo'

export const metadata = metadataPublica({
  titulo: GUIA_RESENA.tituloSeo,
  descripcion: GUIA_RESENA.descripcion,
  ruta: GUIA_RESENA.ruta,
})

export default function EscribirResenaPage() {
  return (
    <GuiaPublica guia={GUIA_RESENA}>
      <p>
        Una reseña útil permite entender qué ocurrió durante un alquiler y cómo terminó esa experiencia.
        Puede ser positiva, negativa o incluir ambas cosas. Su valor está en el contexto y los hechos que
        usted conoce de primera mano, no en la intensidad de los calificativos.
      </p>

      <section id="preparar" className="space-y-4">
        <h2>Revise sus datos antes de redactar</h2>
        <p>
          Confirme a qué persona corresponde su experiencia y el período aproximado del alquiler.
          Consulte los registros que ya conserva de esa relación, como acuerdos, comprobantes o mensajes,
          para recordar las fechas y el desenlace. Si no puede precisar un dato, use una referencia
          aproximada y dígalo claramente.
        </p>
        <p>
          Sus registros le ayudan a escribir con precisión. No necesita pegar en el relato cédulas,
          números de cuenta, teléfonos, direcciones exactas ni conversaciones completas. En La Protectora,
          los datos para identificar al inquilino se ingresan en los campos destinados a ello.
        </p>
      </section>

      <section id="estructura" className="space-y-4">
        <h2>Organice el relato en cuatro partes</h2>
        <ol className="list-decimal space-y-3 pl-5">
          <li><strong>Contexto:</strong> indique si fue propietario o administrador y el período del alquiler.</li>
          <li><strong>Experiencia:</strong> describa pagos, comunicación, cuidado u otro aspecto que haya conocido directamente.</li>
          <li><strong>Aclaración:</strong> si surgió una dificultad, explique qué se conversó o qué se hizo para atenderla.</li>
          <li><strong>Resultado:</strong> indique cómo terminó la situación y si algo sigue pendiente al momento de escribir.</li>
        </ol>
        <div className="space-y-3 rounded-xl border border-line bg-card p-5">
          <h3>Plantilla para adaptar</h3>
          <blockquote className="border-l-2 border-seal/40 pl-4">
            <p>
              Fui [propietario/administrador] durante un alquiler de aproximadamente [período]. Mi
              experiencia con [aspecto concreto] fue la siguiente: [hechos que conoce directamente].
              Cuando ocurrió [situación, si aplica], conversamos o acordamos [respuesta]. Al finalizar
              el alquiler, o al momento de escribir esta reseña, [resultado y asuntos pendientes].
            </p>
          </blockquote>
          <p>Quite las partes que no correspondan. Complete únicamente lo que pueda explicar con su propia experiencia.</p>
        </div>
      </section>

      <section id="ejemplos" className="space-y-5">
        <h2>Ejemplos de una reseña con contexto</h2>
        <p>Estos ejemplos son ficticios y muestran una forma de redactar. No corresponden a personas ni a reseñas del registro.</p>
        <div className="space-y-3 rounded-xl border border-line bg-card p-5">
          <h3>Una experiencia positiva</h3>
          <blockquote className="border-l-2 border-seal/40 pl-4">
            <p>
              Alquilé mi propiedad durante aproximadamente un año. Recibí los pagos en las fechas
              acordadas. Cuando apareció una fuga, el inquilino me avisó y coordinamos la reparación.
              Al terminar, acordamos la entrega de llaves y revisamos la vivienda juntos. No quedaron
              asuntos pendientes entre nosotros al momento de la entrega.
            </p>
          </blockquote>
          <p>El relato explica qué sostuvo la valoración favorable y cuál fue el resultado del alquiler.</p>
        </div>
        <div className="space-y-3 rounded-xl border border-line bg-card p-5">
          <h3>Una experiencia con dificultades</h3>
          <blockquote className="border-l-2 border-seal/40 pl-4">
            <p>
              Administré la propiedad durante un alquiler de ocho meses. En dos ocasiones recibí el
              pago diez días después de la fecha acordada. Conversamos sobre esos atrasos y ambos pagos
              se completaron. Al entregar la vivienda encontramos una puerta dañada; conversamos sobre
              la reparación, pero ese asunto seguía pendiente cuando escribí esta reseña.
            </p>
          </blockquote>
          <p>El relato distingue los pagos ya resueltos de un asunto pendiente, sin convertir ninguno en una acusación más amplia.</p>
        </div>
        <p>
          Evite afirmaciones como «siempre hace esto» si solo conoce su propio alquiler. Describa lo que
          pasó en esa relación y no presente rumores, intenciones supuestas o conclusiones sobre toda
          la vida de una persona como hechos.
        </p>
      </section>

      <section id="revisar" className="space-y-4">
        <h2>Lista de revisión antes de enviar</h2>
        <ul className="list-disc space-y-3 pl-5">
          <li>La identificación corresponde a la persona con quien tuve la relación de alquiler.</li>
          <li>Indiqué el período o aclaré que la fecha es aproximada.</li>
          <li>Conté hechos que conozco directamente y separé mis opiniones.</li>
          <li>Expliqué qué se resolvió y qué seguía pendiente al escribir.</li>
          <li>Quité insultos, rumores y datos personales innecesarios.</li>
          <li>No incluí datos de familiares ni de otras personas ajenas al relato.</li>
          <li>Si elegí publicar de forma anónima, no escribí mi nombre en el texto.</li>
        </ul>
        <p>
          Una experiencia puede cambiar después de redactarla. Antes de enviar, compruebe que el relato
          describe el estado que usted conoce en ese momento.
        </p>
      </section>

      <section id="publicar" className="space-y-4">
        <h2>Cómo enviar su experiencia a La Protectora</h2>
        <p>
          Cree una cuenta como propietario o agencia, identifique al inquilino y escriba el relato en
          el formulario. Puede elegir si su nombre se muestra a otros usuarios; administración puede
          identificar su cuenta durante la revisión, incluso si elige publicar de forma anónima.
        </p>
        <p>
          Las reseñas pasan por revisión antes de publicarse. En su perfil puede consultar el estado y
          las indicaciones de administración. Si le solicitan correcciones, use «Corregir y reenviar»
          para modificar la misma reseña. Su primera reseña aprobada activa 3 meses de consultas gratis;
          crear la cuenta o enviar el texto aún no activa ese acceso.
        </p>
        <p>
          Consulte{' '}
          <Link href="/como-funciona" className="underline underline-offset-4">todos los pasos y las reglas de consulta</Link>{' '}
          y{' '}
          <Link href="/privacidad" className="underline underline-offset-4">qué datos pueden ver otros usuarios</Link>.
        </p>
      </section>
    </GuiaPublica>
  )
}
