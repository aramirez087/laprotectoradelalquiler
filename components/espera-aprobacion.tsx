import Link from 'next/link'
import { motivoEspera } from '@/lib/dal'
import type { Usuario } from '@/lib/tipos'

export async function EsperaAprobacion({ usuario }: { usuario: Usuario }) {
  const motivo = await motivoEspera(usuario)
  const texto =
    motivo === 'revision'
      ? 'Su reseña está en revisión. Cuando administración la apruebe, puede consultar fichas.'
      : motivo === 'rechazada'
        ? 'Ninguna reseña suya está aprobada. Escriba otra para poder consultar fichas.'
        : 'Para consultar fichas, escriba una reseña. Cuando administración la apruebe, puede buscar.'

  return (
    <div className="flex min-h-[72vh] flex-col items-center justify-center px-4 pb-16 text-center">
      <h1 className="text-[2.75rem] font-normal tracking-tight sm:text-6xl">La Protectora</h1>
      <p className="mt-6 max-w-md text-sm text-ink-soft">{texto}</p>
      <Link href="/resenas/nueva" className="btn-primario mt-6 inline-flex">
        Escribir reseña
      </Link>
    </div>
  )
}
