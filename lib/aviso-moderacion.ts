import type { ContenidoCorreo } from '@/lib/plantilla-correo'

export type AvisoModeracion = {
  id: string; token: string; resena_id: number; accion: 'aprobada' | 'corregir' | 'rechazada';
  email: string; nombre: string; cuerpo: Record<string, unknown> | null
}

/** No tenant identity, review text or moderation notes go into email. */
export function contenidoAvisoModeracion(aviso: AvisoModeracion): ContenidoCorreo {
  const correccion = aviso.accion === 'corregir'
  const titulo = aviso.accion === 'aprobada' ? 'Su reseña fue aprobada'
    : correccion ? 'Su reseña necesita una corrección' : 'Su reseña no fue aprobada'
  const instrucciones = aviso.accion === 'aprobada'
    ? 'Revise su permiso de consulta en su perfil. Si está vigente, ya puede buscar reseñas de otros propietarios.'
    : correccion ? 'Revise las instrucciones de administración en su perfil, corrija la misma reseña y vuelva a enviarla.'
      : 'Puede ver el motivo de la decisión en su perfil. Esta reseña no admite reenvío.'
  return { titulo, resumen: 'Una actualización sobre su aporte a La Protectora del Alquiler.',
    parrafos: [`Hola, ${aviso.nombre}.`, `La administración revisó su reseña #${aviso.resena_id}.`, instrucciones],
    accion: { texto: correccion ? 'Corregir mi reseña' : aviso.accion === 'aprobada' ? 'Ver mi permiso y consultar' : 'Ver la decisión',
      url: `https://www.protectoradelalquiler.com/perfil#${aviso.accion === 'aprobada' ? 'acceso-consultas' : 'mis-resenas'}` } }
}
