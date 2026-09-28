import { NextResponse } from 'next/server'
import { ejecutarEliminacionFacebook } from '@/lib/facebook-eliminacion-servidor'
import { codigoEliminacion, leerSolicitudFirmada } from '@/lib/facebook-eliminacion'
import { origenPublico } from '@/lib/facebook-auth'

export async function POST(request: Request) {
  const secreto = process.env.FACEBOOK_APP_SECRET
  if (!secreto) return NextResponse.json({ error: 'not_configured' }, { status: 404 })

  const formulario = await request.formData()
  const firmada = String(formulario.get('signed_request') ?? '')
  const datos = leerSolicitudFirmada(firmada, secreto)
  if (!datos) return NextResponse.json({ error: 'bad_signature' }, { status: 400 })

  const codigo = codigoEliminacion()
  const resultado = await ejecutarEliminacionFacebook(datos.user_id, codigo)
  if (!resultado.ok) return NextResponse.json({ error: 'unavailable' }, { status: 503 })

  const url = `${origenPublico(request)}/auth/facebook/eliminacion/estado?codigo=${encodeURIComponent(codigo)}`
  return NextResponse.json({ url, confirmation_code: codigo })
}
