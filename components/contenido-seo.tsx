import Link from '@/components/enlace'
import { GUIAS_PUBLICAS } from '@/lib/guias'

export const PREGUNTAS_FRECUENTES = [
  {
    pregunta: '¿Quién puede usar La Protectora del Alquiler?',
    respuesta: 'La plataforma está dirigida a propietarios y agencias que alquilan o gestionan propiedades en Costa Rica. Para consultar las experiencias de otros usuarios necesita una cuenta activa y un permiso de consulta vigente.',
  },
  {
    pregunta: '¿Cómo obtengo acceso para consultar reseñas de inquilinos?',
    respuesta: 'Cree su cuenta, confirme su correo y comparta su primera experiencia con un inquilino. Cuando administración aprueba la reseña, obtiene 3 meses de consultas gratis. El permiso comienza con la aprobación, no al crear la cuenta ni al enviar la reseña.',
  },
  {
    pregunta: '¿Las reseñas y los datos de los inquilinos son públicos?',
    respuesta: 'Las fichas y las reseñas requieren iniciar sesión y tener permiso de consulta; no son un directorio público para buscadores. La cédula se muestra enmascarada a otros usuarios, con excepciones de acceso para el autor de la reseña y administración. La página de privacidad explica quién puede ver cada dato.',
  },
  {
    pregunta: '¿Puedo acumular o renovar el tiempo de consulta?',
    respuesta: 'La primera reseña aprobada sobre cada inquilino suma 3 meses. El tiempo no utilizado se acumula, pero el vencimiento no puede superar 12 meses desde la última primera aprobación sobre un inquilino nuevo para usted. Si el permiso venció, una nueva aprobación que cumpla esa regla inicia otro período de 3 meses. Solo cuentan los aportes que mantienen una reseña publicada.',
  },
  {
    pregunta: '¿Puedo escribir varias reseñas sobre el mismo inquilino?',
    respuesta: 'Cada cuenta puede enviar una sola reseña por inquilino. Otros propietarios o agencias pueden compartir sus propias experiencias con esa persona. Editar, volver a aprobar o reenviar una reseña del mismo autor sobre el mismo inquilino no concede tiempo adicional de consulta.',
  },
  {
    pregunta: '¿Se aceptan experiencias positivas y negativas?',
    respuesta: 'Sí. Puede contar una experiencia positiva o negativa de alquiler. Las reseñas de propietarios y agencias se envían a administración para revisión antes de publicarse. Describa lo ocurrido de forma concreta, revise la identidad del inquilino y evite incluir datos personales innecesarios.',
  },
  {
    pregunta: '¿Puedo ocultar mi nombre al compartir una experiencia?',
    respuesta: 'El formulario permite marcar la reseña como anónima. En ese caso otros usuarios no ven el nombre de quien la escribió. Administración sigue pudiendo identificar al autor para revisar la experiencia; la opción no oculta la cuenta a administración.',
  },
  {
    pregunta: '¿Qué hago si una reseña contiene información incorrecta?',
    respuesta: 'Los usuarios pueden denunciar una reseña desde su ficha para que administración la revise. Una reseña aprobada recoge la experiencia de su autor y no garantiza el comportamiento futuro de un inquilino. La ausencia de reseñas tampoco demuestra que una persona sea buena o mala inquilina.',
  },
] as const

export function PreguntasFrecuentes({ breves = false }: { breves?: boolean }) {
  const preguntas = breves ? PREGUNTAS_FRECUENTES.slice(0, 3) : PREGUNTAS_FRECUENTES

  return (
    <section aria-labelledby="preguntas-frecuentes" className="space-y-6">
      <h2 id="preguntas-frecuentes" className="text-2xl sm:text-3xl">Preguntas frecuentes</h2>
      <div className="divide-y divide-line">
        {preguntas.map(({ pregunta, respuesta }) => (
          <div key={pregunta} className="space-y-2 py-5 first:pt-0 last:pb-0">
            <h3 className="text-base font-semibold sm:text-lg">{pregunta}</h3>
            <p className="text-sm leading-relaxed text-ink-soft">{respuesta}</p>
          </div>
        ))}
      </div>
      {breves && (
        <Link href="/como-funciona#preguntas-frecuentes" className="enlace-texto">
          Ver todas las preguntas sobre el acceso y las reseñas →
        </Link>
      )}
    </section>
  )
}

const PASOS = [
  {
    titulo: 'Cree su cuenta',
    texto: 'Regístrese como propietario o agencia y confirme su correo para comenzar a compartir experiencias de alquiler.',
  },
  {
    titulo: 'Comparta una experiencia',
    texto: 'Identifique al inquilino y cuente lo ocurrido. Administración revisa su reseña antes de publicarla.',
  },
  {
    titulo: 'Consulte antes de alquilar',
    texto: 'Su primera reseña aprobada activa 3 meses de consulta. Inicie sesión y busque por nombre o cédula para leer las reseñas disponibles.',
  },
] as const

export function ContenidoInicio() {
  return (
    <div className="contenedor max-w-5xl space-y-14 border-t border-line py-12 sm:space-y-16 sm:py-16">
      <section aria-labelledby="resenas-inquilinos" className="space-y-5">
        <p className="eyebrow">Una comunidad para compartir experiencias</p>
        <h2 id="resenas-inquilinos" className="max-w-3xl text-3xl sm:text-4xl">
          Reseñas de inquilinos en Costa Rica
        </h2>
        <p className="max-w-3xl text-base leading-relaxed text-ink-soft">
          La Protectora del Alquiler reúne experiencias de propietarios y agencias sobre sus inquilinos.
          Antes de alquilar una casa, un apartamento u otra propiedad, puede consultar los relatos publicados
          por otros miembros y contar con más información para su decisión.
        </p>
        <p className="max-w-3xl text-sm leading-relaxed text-ink-soft">
          La consulta se realiza dentro de la plataforma, con una cuenta y acceso vigente. Las reseñas
          complementan su evaluación del alquiler: no garantizan pagos ni el comportamiento futuro de una persona.
        </p>
        <Link href="/como-funciona" className="enlace-texto">
          Conozca cómo funciona la consulta de reseñas →
        </Link>
      </section>

      <section aria-labelledby="pasos-consulta" className="space-y-6">
        <h2 id="pasos-consulta" className="text-2xl sm:text-3xl">De su experiencia a una decisión informada</h2>
        <ol className="grid gap-6 sm:grid-cols-3">
          {PASOS.map(({ titulo, texto }, indice) => (
            <li key={titulo} className="space-y-3 border-t border-line pt-5">
              <span className="numero-paso" aria-hidden="true">{indice + 1}</span>
              <h3 className="text-lg">{titulo}</h3>
              <p className="text-sm leading-relaxed text-ink-soft">{texto}</p>
            </li>
          ))}
        </ol>
        <Link href="/registro" className="enlace-texto">Crear una cuenta de propietario o agencia →</Link>
      </section>

      <section aria-labelledby="privacidad-consulta" className="space-y-4 rounded-2xl border border-line bg-card p-6 sm:p-8">
        <p className="eyebrow">Reseñas con revisión y acceso reservado</p>
        <h2 id="privacidad-consulta" className="text-2xl sm:text-3xl">Experiencias compartidas con cuidado</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-ink-soft">
          Las reseñas de propietarios y agencias pasan por revisión antes de publicarse. Puede compartir
          experiencias positivas y negativas, elegir que su nombre no se muestre a otros usuarios y denunciar
          una reseña para que administración la revise. Las fichas de inquilinos no son un directorio público.
        </p>
        <Link href="/privacidad" className="enlace-texto">Revise cómo se usan y protegen los datos →</Link>
      </section>

      <section aria-labelledby="guias-propietarios" className="space-y-6">
        <div className="space-y-3">
          <p className="eyebrow">Recursos para su próximo alquiler</p>
          <h2 id="guias-propietarios" className="text-2xl sm:text-3xl">Prepare sus referencias y comparta su experiencia</h2>
          <p className="max-w-3xl text-sm leading-relaxed text-ink-soft">Guías prácticas con preguntas, plantillas y ejemplos que puede consultar sin crear una cuenta.</p>
        </div>
        <ul className="grid gap-6 sm:grid-cols-3">
          {GUIAS_PUBLICAS.map(guia => <li key={guia.ruta} className="space-y-3 border-t border-line pt-5">
            <h3 className="text-lg"><Link href={guia.ruta} className="enlace-texto">{guia.nombre}</Link></h3>
            <p className="text-sm leading-relaxed text-ink-soft">{guia.resumen}</p>
          </li>)}
        </ul>
        <Link href="/guias" className="enlace-texto">Ver las guías para propietarios →</Link>
      </section>

      <PreguntasFrecuentes breves />
    </div>
  )
}
