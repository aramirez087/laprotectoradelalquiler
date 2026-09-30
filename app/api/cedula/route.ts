import { createHmac } from 'node:crypto'
import { consultarCedula } from '@/lib/padron'
import { cedulaNacional } from '@/lib/cedula'
import { createAdmin } from '@/lib/supabase/admin'
import { registrarError } from '@/lib/registro-error'
import { esOrigenPropio } from '@/lib/origen'

function respuesta(datos: unknown, status = 200) {
  return Response.json(datos, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' } })
}

// POST evita colocar la cédula en URLs, historial y registros de acceso.
export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && !esOrigenPropio(request)) return respuesta({ estado: 'no_disponible' }, 403)
  if (Number(request.headers.get('content-length') ?? 0) > 1024) return respuesta({ estado: 'no_aplica' }, 413)
  try {
    const texto = await request.text()
    if (texto.length > 1024) return respuesta({ estado: 'no_aplica' }, 413)
    const cuerpo = JSON.parse(texto)
    const cedula = typeof cuerpo?.cedula === 'string' ? cedulaNacional(cuerpo.cedula) : null
    if (!cedula) return respuesta({ estado: 'no_aplica' }, 422)
    const db = createAdmin({ requestTimeoutMs: 6000 })
    const secreto = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!db || !secreto) return respuesta({ estado: 'no_disponible' }, 503)
    // El proxy del despliegue fija x-forwarded-for. Sin proxy se comparte un cupo conservador.
    const ip = (request.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim()
    const clave = createHmac('sha256', secreto).update(`padron:${ip}`).digest('hex')
    const limite = await db.rpc('consumir_consulta_padron', { p_clave: clave })
    if (limite.error) {
      registrarError('padron_quota_error', limite.error, { route: '/api/cedula' })
      return respuesta({ estado: 'no_disponible' }, 503)
    }
    if (limite.data !== true) return respuesta({ estado: 'limite' }, 429)
    return respuesta(await consultarCedula(cedula))
  } catch (error) {
    if (error instanceof SyntaxError) return respuesta({ estado: 'no_aplica' }, 400)
    registrarError('padron_api_error', error, { route: '/api/cedula' })
    return respuesta({ estado: 'no_disponible' }, 503)
  }
}
