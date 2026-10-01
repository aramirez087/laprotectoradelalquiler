import * as z from 'zod'

export const CamposBorrador = z.object({
  identificacion: z.string().max(30),
  nombre: z.string().max(100),
  nombre2: z.string().max(100),
  apellido1: z.string().max(100),
  apellido2: z.string().max(100),
  comentario: z.string().max(5000),
  anonima: z.boolean(),
}).strict()

export type DatosBorrador = z.infer<typeof CamposBorrador>
export type BorradorResena = { version: string | null; datos: DatosBorrador | null }
export type EstadoBorrador = BorradorResena & { disponible: boolean }

export function datosBorrador(form: HTMLFormElement): DatosBorrador {
  const datos = new FormData(form)
  const texto = (campo: string) => String(datos.get(campo) ?? '')
  return { identificacion: texto('identificacion'), nombre: texto('nombre'), nombre2: texto('nombre2'),
    apellido1: texto('apellido1'), apellido2: texto('apellido2'), comentario: texto('comentario'),
    anonima: datos.get('anonima') === '1' }
}
