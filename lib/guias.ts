export const GUIA_REFERENCIAS = {
  ruta: '/guias/referencias-de-inquilinos',
  eventoRegistro: 'guia_referencias_registro',
  nombre: 'Referencias de inquilinos',
  titulo: 'Cómo pedir y evaluar referencias de inquilinos en Costa Rica',
  tituloSeo: 'Referencias de inquilinos en Costa Rica | Guía práctica',
  descripcion: 'Aprenda a pedir referencias de alquiler, organizar las respuestas y contrastar experiencias. Incluye un mensaje modelo y una lista de verificación.',
  resumen: 'Un proceso para pedir referencias, aclarar dudas y distinguir los hechos de las opiniones antes de alquilar.',
  recurso: 'Mensaje modelo y lista de verificación',
  secciones: [
    { id: 'pedir-referencias', nombre: 'Cómo pedir una referencia' },
    { id: 'confirmar-contexto', nombre: 'Qué confirmar al conversar' },
    { id: 'evaluar-respuestas', nombre: 'Cómo evaluar las respuestas' },
    { id: 'sin-referencias', nombre: 'Si no hay referencias' },
    { id: 'lista-verificacion', nombre: 'Lista de verificación' },
  ],
} as const

export const GUIA_PREGUNTAS = {
  ruta: '/guias/preguntas-para-arrendadores',
  eventoRegistro: 'guia_preguntas_registro',
  nombre: 'Preguntas para un arrendador anterior',
  titulo: 'Qué preguntar a un arrendador anterior al pedir referencias',
  tituloSeo: 'Preguntas para pedir referencias de alquiler | La Protectora',
  descripcion: 'Guion de preguntas para un arrendador anterior: pagos, comunicación, cuidado y entrega. Incluye una plantilla para anotar respuestas con contexto.',
  resumen: 'Un guion de conversación para conocer cómo se desarrolló un alquiler anterior, con preguntas concretas y espacio para aclaraciones.',
  recurso: 'Guion de conversación y plantilla de notas',
  secciones: [
    { id: 'antes-de-llamar', nombre: 'Antes de llamar' },
    { id: 'preguntas', nombre: 'Preguntas para la conversación' },
    { id: 'aclaraciones', nombre: 'Cómo aclarar respuestas vagas' },
    { id: 'plantilla', nombre: 'Plantilla para tomar notas' },
    { id: 'cerrar-conversacion', nombre: 'Al terminar la conversación' },
  ],
} as const

export const GUIA_RESENA = {
  ruta: '/guias/como-escribir-una-resena',
  eventoRegistro: 'guia_resena_registro',
  nombre: 'Cómo escribir una reseña',
  titulo: 'Cómo escribir una reseña útil sobre un inquilino',
  tituloSeo: 'Cómo escribir una reseña de un inquilino | La Protectora',
  descripcion: 'Organice su experiencia de alquiler en una reseña clara: período, hechos y resultado. Incluye una plantilla, ejemplos ficticios y una lista de revisión.',
  resumen: 'Una estructura para contar su experiencia con hechos concretos y contexto, tanto si fue positiva como si hubo dificultades.',
  recurso: 'Plantilla de reseña y ejemplos ficticios',
  secciones: [
    { id: 'preparar', nombre: 'Qué revisar antes de escribir' },
    { id: 'estructura', nombre: 'Una estructura para su relato' },
    { id: 'ejemplos', nombre: 'Ejemplos de redacción' },
    { id: 'revisar', nombre: 'Lista antes de enviar' },
    { id: 'publicar', nombre: 'Cómo enviarla a La Protectora' },
  ],
} as const

export const GUIAS_PUBLICAS = [GUIA_REFERENCIAS, GUIA_PREGUNTAS, GUIA_RESENA] as const
export type InfoGuia = (typeof GUIAS_PUBLICAS)[number]
