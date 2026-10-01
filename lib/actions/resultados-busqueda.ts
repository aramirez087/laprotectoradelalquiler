'use server'

import { obtenerUsuario, puedeConsultar } from '@/lib/dal'
import { createAdmin } from '@/lib/supabase/admin'
import { registrarError } from '@/lib/registro-error'
import { leerResultadoConfirmado } from '@/lib/resultado-busqueda-confirmado'

export async function registrarResultadoBusquedaAction(token: string) {
  try {
    const usuario = await obtenerUsuario()
    if (!usuario?.activo || !['propietario', 'agencia'].includes(usuario.rol)) return
    const prueba = leerResultadoConfirmado(token, usuario.id)
    if (!prueba || !(await puedeConsultar(usuario))) return
    const db = createAdmin({ requestTimeoutMs: 8000 })
    if (!db) return
    if (prueba.persona !== null) {
      // Recheck publication with a HEAD count; never fetch a tenant's review text.
      const publicadas = await db.from('resenas').select('id', { count: 'exact', head: true })
        .eq('persona_id', prueba.persona).eq('estado', 'publicada').limit(1)
      if (publicadas.error) throw publicadas.error
      if (!publicadas.count) return
    }
    const respuesta = await db.rpc('registrar_resultado_busqueda', {
      p_usuario_id: usuario.id, p_id: prueba.id, p_iniciada_en: new Date(prueba.iniciada).toISOString(),
      p_tipo: prueba.tipo, p_con_resultados: prueba.resultados, p_abrio_ficha: prueba.persona !== null,
    })
    if (respuesta?.error) throw respuesta.error
  } catch (error) { registrarError('search_outcome_error', error) }
}
