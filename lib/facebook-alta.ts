import { createAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { esCedulaValida, normalizarPerfilFacebook } from '@/lib/util'
import { altaLista, authFacebookHabilitado, cuentaCreadaConFacebook } from '@/lib/facebook-auth'

type FilaAlta = {
  id: number
  auth_user_id: string | null
  identificacion: string | null
  rol: string
}

export async function altaFacebookLista(authUserId: string) {
  const admin = createAdmin()
  if (!admin) return false
  const { data, error } = await admin
    .from('usuarios')
    .select('id, identificacion')
    .eq('auth_user_id', authUserId)
    .maybeSingle()
  if (error || !data) return false
  const { data: facebook, error: errorFacebook } = await admin
    .from('autenticaciones')
    .select('proveedor_id')
    .eq('usuario_id', data.id)
    .eq('proveedor', 'facebook')
    .maybeSingle()
  if (errorFacebook) return false
  return altaLista(data.identificacion, facebook?.proveedor_id ?? null)
}

/**
 * Si el correo de Facebook ya es una cuenta completa sin auth, la enlaza.
 * No pisa el rol ni la cédula que ya tenía.
 */
export async function vincularCuentaListaPorCorreo(authUserId: string, email: string | null | undefined) {
  if (await altaFacebookLista(authUserId)) return true
  const admin = createAdmin()
  const correo = email?.trim().toLowerCase()
  if (!admin || !correo) return false
  const { data, error } = await admin
    .from('usuarios')
    .select('id, auth_user_id, identificacion')
    .eq('email', correo)
    .maybeSingle()
  if (error || !data || data.auth_user_id) return false
  if (!esCedulaValida(data.identificacion)) return false
  const { data: facebook, error: errorFacebook } = await admin
    .from('autenticaciones')
    .select('proveedor_id')
    .eq('usuario_id', data.id)
    .eq('proveedor', 'facebook')
    .maybeSingle()
  if (errorFacebook || !normalizarPerfilFacebook(facebook?.proveedor_id ?? null)) return false
  const { error: errorUpdate } = await admin
    .from('usuarios')
    .update({ auth_user_id: authUserId, ultimo_acceso: new Date().toISOString() })
    .eq('id', data.id)
    .is('auth_user_id', null)
  return !errorUpdate
}

export async function altaFacebookPendiente() {
  if (!authFacebookHabilitado()) return false
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !cuentaCreadaConFacebook(user)) return false
  return !(await altaFacebookLista(user.id))
}

export async function previaAltaFacebook(authUserId: string, email: string) {
  const admin = createAdmin()
  if (!admin) return null
  const porAuth = await admin
    .from('usuarios')
    .select('id, auth_user_id, identificacion, rol')
    .eq('auth_user_id', authUserId)
    .maybeSingle()
  if (porAuth.error) return null
  let fila = porAuth.data as FilaAlta | null
  if (!fila && email) {
    const porEmail = await admin
      .from('usuarios')
      .select('id, auth_user_id, identificacion, rol')
      .eq('email', email)
      .maybeSingle()
    if (porEmail.error) return null
    const candidata = porEmail.data as FilaAlta | null
    if (candidata && !candidata.auth_user_id) fila = candidata
  }
  if (!fila) return { existe: false, cedula: '', facebook: '' }
  const { data: facebook } = await admin
    .from('autenticaciones')
    .select('proveedor_id')
    .eq('usuario_id', fila.id)
    .eq('proveedor', 'facebook')
    .maybeSingle()
  return {
    existe: true,
    cedula: fila.identificacion ?? '',
    facebook: normalizarPerfilFacebook(facebook?.proveedor_id ?? null) ?? '',
  }
}
