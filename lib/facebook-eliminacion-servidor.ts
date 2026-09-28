import { createAdmin } from '@/lib/supabase/admin'
import { correoEliminado } from '@/lib/facebook-eliminacion'

type EstadoEliminacion = 'completada' | 'sin_cuenta'

type Perfil = {
  id: number
  email: string
  activo: boolean
  auth_user_id: string | null
  avatar_url: string | null
}

type EnlaceFacebook = {
  usuario_id: number
  proveedor: string
  proveedor_id: string
}

function adminListo() {
  const admin = createAdmin()
  if (!admin) return null
  return admin
}

async function anotar(codigo: string, facebookUserId: string, estado: EstadoEliminacion) {
  const admin = adminListo()
  if (!admin) return false
  const { error } = await admin.from('eliminaciones_facebook').insert({
    codigo,
    facebook_user_id: facebookUserId,
    estado,
  })
  return !error
}

async function perfilDe(authUserId: string) {
  const admin = adminListo()
  if (!admin) return { admin: null, perfil: null }
  const { data, error } = await admin
    .from('usuarios')
    .select('id, email, activo, auth_user_id, avatar_url')
    .eq('auth_user_id', authUserId)
    .maybeSingle()
  if (error) return { admin, perfil: undefined }
  return { admin, perfil: (data as Perfil | null) ?? null }
}

async function quitarEnlacePublico(usuarioId: number) {
  const admin = adminListo()
  if (!admin) return null
  const { data, error } = await admin
    .from('autenticaciones')
    .delete()
    .eq('usuario_id', usuarioId)
    .eq('proveedor', 'facebook')
    .select('usuario_id, proveedor, proveedor_id')
  return error ? null : (data as EnlaceFacebook[])
}

async function restaurarEnlacePublico(enlaces: EnlaceFacebook[]) {
  if (enlaces.length === 0) return true
  const admin = adminListo()
  if (!admin) return false
  const { error } = await admin.from('autenticaciones').insert(enlaces)
  return !error
}

export async function ejecutarEliminacionFacebook(facebookUserId: string, codigo: string) {
  const admin = adminListo()
  if (!admin) return { ok: false as const }

  const busqueda = await admin.rpc('buscar_auth_por_facebook', { p_proveedor_id: facebookUserId })
  if (busqueda.error) return { ok: false as const }
  const authUserId = typeof busqueda.data === 'string' ? busqueda.data : null
  if (!authUserId) {
    const anotada = await anotar(codigo, facebookUserId, 'sin_cuenta')
    return anotada ? { ok: true as const, estado: 'sin_cuenta' as const } : { ok: false as const }
  }

  const cuenta = await admin.auth.admin.getUserById(authUserId)
  if (cuenta.error || !cuenta.data.user) return { ok: false as const }
  const identidades = cuenta.data.user.identities ?? []
  const otras = identidades.filter((identidad) => identidad.provider !== 'facebook')
  const { perfil } = await perfilDe(authUserId)
  if (perfil === undefined) return { ok: false as const }

  const enlaces = perfil ? await quitarEnlacePublico(perfil.id) : []
  if (!enlaces) return { ok: false as const }

  if (otras.length > 0) {
    const quitada = await admin.rpc('quitar_identidad_facebook', { p_user_id: authUserId })
    if (quitada.error || quitada.data !== true) {
      await restaurarEnlacePublico(enlaces)
      return { ok: false as const }
    }
    const metadatos = { ...cuenta.data.user.user_metadata }
    delete metadatos.facebook
    await admin.auth.admin.updateUserById(authUserId, { user_metadata: metadatos })
    const anotada = await anotar(codigo, facebookUserId, 'completada')
    return anotada ? { ok: true as const, estado: 'completada' as const } : { ok: false as const }
  }

  let restaurar: Perfil | null = null
  if (perfil) {
    restaurar = perfil
    const { error } = await admin
      .from('usuarios')
      .update({
        activo: false,
        email: correoEliminado(codigo),
        auth_user_id: null,
        avatar_url: null,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', perfil.id)
    if (error) {
      await restaurarEnlacePublico(enlaces)
      return { ok: false as const }
    }
  }

  const borrado = await admin.auth.admin.deleteUser(authUserId)
  if (borrado.error) {
    const yaNoEsta = /not found/i.test(borrado.error.message)
    if (!yaNoEsta && restaurar) {
      await admin
        .from('usuarios')
        .update({
          activo: restaurar.activo,
          email: restaurar.email,
          auth_user_id: restaurar.auth_user_id,
          avatar_url: restaurar.avatar_url,
        })
        .eq('id', restaurar.id)
    }
    if (!yaNoEsta) {
      await restaurarEnlacePublico(enlaces)
      return { ok: false as const }
    }
  }

  const anotada = await anotar(codigo, facebookUserId, 'completada')
  return anotada ? { ok: true as const, estado: 'completada' as const } : { ok: false as const }
}

export async function estadoEliminacionFacebook(codigo: string) {
  const admin = adminListo()
  if (!admin) return null
  const { data, error } = await admin
    .from('eliminaciones_facebook')
    .select('estado, creado_en')
    .eq('codigo', codigo)
    .maybeSingle()
  if (error || !data) return null
  return data as { estado: EstadoEliminacion; creado_en: string }
}
