import { consultarResenas, periodoPorDefecto } from '@/lib/admin'
import { obtenerUsuario } from '@/lib/dal'
import { etiquetaEstado, fechaCorta, nombreCompleto } from '@/lib/util'

function celda(valor: string | number | null | undefined) {
  const texto = valor == null ? '' : String(valor)
  if (/[",\n\r]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`
  return texto
}

export async function GET(request: Request) {
  const usuario = await obtenerUsuario()
  if (!usuario || usuario.rol !== 'admin') {
    return new Response('No autorizado', { status: 401 })
  }

  const url = new URL(request.url)
  const { desde, hasta } = periodoPorDefecto(url.searchParams.get('desde') ?? '', url.searchParams.get('hasta') ?? '')
  const filas = []

  try {
    for (let pagina = 1; pagina <= 5; pagina += 1) {
      const resultado = await consultarResenas({ desde, hasta, pagina, limite: 1000 })
      filas.push(...resultado.filas)
      if (filas.length >= resultado.total || resultado.filas.length < 1000) break
    }
  } catch {
    return new Response('No se pudo generar el reporte.', { status: 500 })
  }

  const lineas = [
    ['fecha', 'persona', 'identificacion', 'autor', 'estado', 'anonima', 'comentario'].join(','),
    ...filas.map((fila) =>
      [
        fechaCorta(fila.creado_en) ?? '',
        nombreCompleto(fila.persona),
        fila.persona.identificacion,
        fila.autor?.nombre ?? '',
        etiquetaEstado(fila.estado),
        fila.anonima ? 'sí' : 'no',
        fila.comentario ?? '',
      ]
        .map(celda)
        .join(','),
    ),
  ]

  return new Response(`\uFEFF${lineas.join('\n')}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="resenas-${desde}-a-${hasta}.csv"`,
    },
  })
}
