// Tipos de la base de datos v2 (espejo de schema.sql)

// Conserva el rol histórico para leer cuentas existentes; ya no se puede asignar.
export type Rol = 'admin' | 'propietario' | 'agencia' | 'inquilino'
export type RolAsignable = Exclude<Rol, 'inquilino'>
export type EstadoResena = 'borrador' | 'publicada' | 'oculta'

export interface Usuario {
  id: number
  auth_user_id: string | null
  email: string
  nombre: string
  persona_id: number | null
  identificacion: string | null
  telefono: string | null
  avatar_url: string | null
  rol: Rol
  activo: boolean
  ultimo_acceso: string | null
  creado_en: string
}

export interface Persona {
  id: number
  identificacion: string
  nombre: string
  nombre2: string | null
  apellido1: string
  apellido2: string | null
  pais_id: number | null
  fecha_nacimiento: string | null
  sexo: string | null
  foto_url: string | null
  provincia_id: number | null
  canton_id: number | null
  distrito_id: number | null
  barrio_id: number | null
  creado_en: string
}

export interface Calificacion {
  id: number
  valor: number
  texto: string
}

export interface Etiqueta {
  id: number
  nombre: string
  tipo: 'inquilino' | 'propietario'
}

export interface Resena {
  id: number
  persona_id: number
  autor_id: number
  vivienda_id: number | null
  tipo: 'inquilino' | 'propietario'
  calificacion_id: number | null
  recomienda: boolean | null
  drogas: boolean | null
  dano_vivienda_id: number | null
  detalle_dano: string | null
  proceso_judicial_id: number | null
  tipo_contrato_id: number | null
  tipo_alquiler_id: number | null
  tiempo_alquiler_id: number | null
  fecha_inicio_alquiler: string | null
  fecha_fin_alquiler: string | null
  comentario: string | null
  anonima: boolean
  verificada: boolean
  detalle_verificacion: string | null
  estado: EstadoResena
  fuente: string | null
  id_fuente: number | null
  creado_en: string
}

export interface FotoResena {
  id: number
  resena_id: number
  url: string
  descripcion: string | null
  orden: number
}

export interface Denuncia {
  id: number
  resena_id: number
  denunciante_id: number
  motivo: 'informacion_falsa' | 'difamacion' | 'datos_incorrectos' | 'otro'
  detalle: string | null
  estado: 'pendiente' | 'aceptada' | 'rechazada'
  creado_en: string
}

export interface VistaFicha {
  persona: Pick<Persona, 'id' | 'identificacion' | 'nombre' | 'nombre2' | 'apellido1' | 'apellido2' | 'foto_url'>
  resenas: number
  ultima: string | null
}

export interface NombreId {
  id: number
  nombre: string
}

export interface Lookups {
  calificaciones: Calificacion[]
  etiquetas: Etiqueta[]
  danos: NombreId[]
  procesos: NombreId[]
  contratos: NombreId[]
  tiposAlquiler: NombreId[]
  tiempos: NombreId[]
  provincias: NombreId[]
}

export interface FilaResenaCompleta {
  id: number
  estado: EstadoResena
  comentario: string | null
  verificada: boolean
  creado_en: string
  anonima: boolean
  /** La reseña es de quien está mirando la ficha. No revela la cuenta a los demás. */
  propia: boolean
  autor: { id: number; nombre: string; rol: Rol } | null
}

export interface FichaCompleta {
  id: number
  identificacion: string
  nombre: string
  nombre2: string | null
  apellido1: string
  apellido2: string | null
  foto_url: string | null
  resenas: FilaResenaCompleta[]
}
