'use server'

import { registrarError } from '@/lib/registro-error'

import { revalidatePath } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import * as z from 'zod'
import { actualizarDatosUsuario, actualizarUsuario, AvisoAdmin, decidirResena, editarResena, eliminarResena, resolverDenuncia } from '@/lib/admin'
import { notificarCambioResena } from '@/lib/correo-resenas'
import type { EstadoForm } from './auth'
import type { EstadoResena } from '@/lib/tipos'

const SchemaDecision = z.object({
  id: z.coerce.number().int().positive(),
  version: z.coerce.number().int().positive(),
  decision: z.enum(['publicar', 'corregir', 'rechazar', 'revisar']),
  nota: z.string().trim().max(2000).optional().or(z.literal('')),
}).refine(input => input.decision !== 'corregir' || !!input.nota, {
  path: ['nota'], message: 'Explique qué debe corregir el autor antes de permitir el reenvío.',
})

const SchemaUsuario = z.object({
  id: z.coerce.number().int().positive(),
  rol: z.enum(['admin', 'propietario', 'agencia', 'inquilino']),
  version: z.string().min(1).max(60),
})

const SchemaDenuncia = z.object({
  id: z.coerce.number().int().positive(),
  decision: z.enum(['aceptar', 'rechazar']),
})

const ESTADO: Record<z.infer<typeof SchemaDecision>['decision'], EstadoResena> = {
  publicar: 'publicada',
  rechazar: 'oculta',
  corregir: 'oculta',
  revisar: 'borrador',
}

function aviso(e: unknown) {
  if (e instanceof AvisoAdmin) return e.message
  registrarError('admin_action_error', e, { routeType: 'action' })
  return 'No se pudo guardar.'
}

function revalidarResena(personaId?: number | Array<number | null | undefined>) {
  revalidatePath('/', 'layout')
  revalidatePath('/admin')
  revalidatePath('/admin/resenas')
  revalidatePath('/admin/revision')
  revalidatePath('/admin/rechazadas')
  revalidatePath('/admin/conteo')
  revalidatePath('/admin/reportes')
  revalidatePath('/admin/usuarios')
  revalidatePath('/fichas')
  revalidatePath('/perfil')
  const ids = Array.isArray(personaId) ? personaId : [personaId]
  for (const id of new Set(ids)) {
    if (id) revalidatePath(`/fichas/${id}`)
  }
}

const SchemaEditarResena = z.object({
  id: z.coerce.number().int().positive(),
  version: z.coerce.number().int().positive(),
  identificacion: z.string().trim().max(30),
  nombre: z.string().trim().min(1, 'Escriba el nombre'),
  nombre2: z.string().trim().max(100).optional().or(z.literal('')),
  apellido1: z.string().trim().min(1, 'Escriba el primer apellido'),
  apellido2: z.string().trim().max(100).optional().or(z.literal('')),
  comentario: z.string().trim().min(1, 'Escriba el relato').max(5000, 'El relato es muy largo'),
})

const SchemaEliminarResena = z.object({
  id: z.coerce.number().int().positive(),
  confirmar: z.literal('1'),
})

function camposDe(error: z.ZodError) {
  return Object.fromEntries(error.issues.map((issue) => [String(issue.path[0]), issue.message]))
}

export async function decidirResenaAction(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const parsed = SchemaDecision.safeParse({
    id: formData.get('id'),
    version: formData.get('version'),
    decision: formData.get('decision'),
    nota: formData.get('nota') ?? '',
  })
  if (!parsed.success) return { error: 'Revise la decisión y actualice la página si la reseña cambió.', campos: camposDe(parsed.error) }

  try {
    const resultado = await decidirResena({
      id: parsed.data.id,
      version: parsed.data.version,
      estado: ESTADO[parsed.data.decision],
      nota: parsed.data.nota ?? '',
      permiteCorreccion: parsed.data.decision === 'corregir',
    })
    const correo = parsed.data.decision === 'publicar' ? await notificarCambioResena({
      solicitada: formData.get('notificar') === '1',
      accion: 'aprobada',
      resenaId: parsed.data.id,
      autor: resultado.autor,
    }) : {}
    revalidarResena(resultado.personaId)
    const mensaje = {
      publicar: 'Reseña aprobada y publicada.',
      rechazar: 'Reseña rechazada.',
      corregir: 'Correcciones solicitadas. El autor puede corregir y reenviar desde su perfil.',
      revisar: 'Reseña devuelta a revisión.',
    }[parsed.data.decision]
    return { mensaje: [mensaje, correo.mensaje].filter(Boolean).join(' '), advertencia: correo.advertencia }
  } catch (e) {
    unstable_rethrow(e)
    return { error: aviso(e) }
  }
}

export async function editarResenaAction(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const parsed = SchemaEditarResena.safeParse({
    id: formData.get('id'),
    version: formData.get('version'),
    identificacion: formData.get('identificacion'),
    nombre: formData.get('nombre'),
    nombre2: formData.get('nombre2') ?? '',
    apellido1: formData.get('apellido1'),
    apellido2: formData.get('apellido2') ?? '',
    comentario: formData.get('comentario'),
  })
  if (!parsed.success) return { error: 'Revise los campos indicados.', campos: camposDe(parsed.error) }

  try {
    const resultado = await editarResena({
      ...parsed.data,
      nombre2: parsed.data.nombre2 ?? '',
      apellido2: parsed.data.apellido2 ?? '',
      anonima: formData.get('anonima') === '1',
    })
    const correo = await notificarCambioResena({
      solicitada: formData.get('notificar') === '1',
      accion: 'modificada',
      resenaId: parsed.data.id,
      autor: resultado.autor,
    })
    revalidarResena([resultado.personaId, resultado.personaAnteriorId])
    const mensaje = resultado.movida ? 'La reseña quedó en la ficha de esa cédula.' : 'Reseña actualizada.'
    return { mensaje: [mensaje, correo.mensaje].filter(Boolean).join(' '), advertencia: correo.advertencia }
  } catch (e) {
    unstable_rethrow(e)
    return { error: aviso(e) }
  }
}

export async function eliminarResenaAction(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const parsed = SchemaEliminarResena.safeParse({
    id: formData.get('id'),
    confirmar: formData.get('confirmar'),
  })
  if (!parsed.success) return { error: 'Confirme la eliminación.' }

  try {
    const resultado = await eliminarResena(parsed.data.id)
    const correo = await notificarCambioResena({
      solicitada: formData.get('notificar') === '1',
      accion: 'eliminada',
      resenaId: parsed.data.id,
      autor: resultado.autor,
    })
    revalidarResena(resultado.personaId)
    return { mensaje: ['Reseña eliminada.', correo.mensaje].filter(Boolean).join(' '), advertencia: correo.advertencia }
  } catch (e) {
    unstable_rethrow(e)
    return { error: aviso(e) }
  }
}

export async function guardarUsuarioAction(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const parsed = SchemaUsuario.safeParse({
    id: formData.get('id'),
    rol: formData.get('rol'),
    version: formData.get('version'),
  })
  if (!parsed.success) return { error: 'Revise el usuario.' }

  try {
    const cuenta = await actualizarUsuario({
      id: parsed.data.id,
      rol: parsed.data.rol,
      activo: formData.get('activo') === 'on',
      versionEsperada: parsed.data.version,
    })
    revalidatePath('/admin/usuarios')
    revalidatePath('/admin')
    revalidatePath(`/admin/usuarios/${cuenta.id}`)
    revalidatePath('/admin/conteo')
    return { mensaje: `Permisos de ${cuenta.nombre} actualizados.` }
  } catch (e) {
    unstable_rethrow(e)
    return { error: aviso(e) }
  }
}

export async function guardarDatosUsuarioAction(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const schema = z.object({
    id: z.coerce.number().int().positive(), version: z.string().min(1).max(60),
    nombre: z.string().trim().min(3, 'Escriba un nombre de al menos 3 caracteres.').max(150, 'El nombre admite hasta 150 caracteres.'),
    identificacion: z.string().trim().max(30, 'El documento es demasiado largo.'),
    telefono: z.string().trim().max(30, 'El teléfono admite hasta 30 caracteres.'),
  })
  const parsed = schema.safeParse(Object.fromEntries(['id', 'version', 'nombre', 'identificacion', 'telefono'].map(k => [k, formData.get(k)])))
  if (!parsed.success) return { error: 'Revise los campos indicados.', campos: camposDe(parsed.error) }
  try {
    const cuenta = await actualizarDatosUsuario({ ...parsed.data, versionEsperada: parsed.data.version })
    revalidatePath('/', 'layout')
    revalidatePath('/admin/usuarios')
    revalidatePath(`/admin/usuarios/${cuenta.id}`)
    revalidatePath('/admin/conteo')
    return { mensaje: `Datos de ${cuenta.nombre} actualizados.` }
  } catch (e) {
    unstable_rethrow(e)
    return { error: aviso(e) }
  }
}

export async function resolverDenunciaAction(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const parsed = SchemaDenuncia.safeParse({
    id: formData.get('id'),
    decision: formData.get('decision'),
  })
  if (!parsed.success) return { error: 'Revise la denuncia.' }

  try {
    const personaId = await resolverDenuncia({
      id: parsed.data.id,
      aceptar: parsed.data.decision === 'aceptar',
    })
    revalidarResena(personaId ?? undefined)
    return { mensaje: parsed.data.decision === 'aceptar' ? 'Denuncia aceptada. La reseña quedó rechazada.' : 'Denuncia rechazada.' }
  } catch (e) {
    unstable_rethrow(e)
    return { error: aviso(e) }
  }
}
