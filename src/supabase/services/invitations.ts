import { supabase } from '../client'
import { PipelineType } from '@/lib/types'

interface CreateInvitationPayload {
  equipo_id: string | null
  empresa_id?: string
  invited_email: string
  invited_nombre: string
  invited_titulo_trabajo: string
  pipeline_ids: Set<PipelineType>
  permission_role?: string
}

export async function createInvitation(payload: CreateInvitationPayload) {
  const { data, error } = await supabase.functions.invoke('invite-member', {
    body: {
      email: payload.invited_email,
      teamId: payload.equipo_id,
      companyId: payload.empresa_id,
      name: payload.invited_nombre,
      role: payload.invited_titulo_trabajo,
      pipelineIds: Array.from(payload.pipeline_ids),
      permissionRole: payload.permission_role || 'viewer'
    }
  })

  if (error) throw error
  return data
}

export async function getPendingInvitations(email: string) {
  const { data, error } = await supabase
    .from('equipo_invitaciones')
    .select('*')
    .eq('invited_email', email)
    .eq('status', 'pending')

  if (error) throw error
  return data
}

export async function getPendingInvitationsByCompany(companyId: string) {
  const { data, error } = await supabase
    .from('equipo_invitaciones')
    .select('*')
    .eq('empresa_id', companyId)
    .eq('status', 'pending')

  if (error) throw error
  return data
}

export async function acceptInvitation(token: string, userId: string) {
  const { data, error } = await supabase.functions.invoke('accept-invite', {
    body: {
      token,
      userId
    }
  })

  if (error) throw error
  return data
}

export async function rejectInvitation(invitationId: string) {
  // 1. Primero obtener datos de la invitación para notificar al dueño
  const { data: invitation, error: fetchError } = await supabase
    .from('equipo_invitaciones')
    .select(`
            invited_nombre,
            invited_email,
            empresa:empresa_id (
                nombre_empresa,
                usuario_id
            ),
            equipo:equipo_id (
                nombre_equipo
            )
        `)
    .eq('id', invitationId)
    .single()

  if (fetchError) throw fetchError

  // 2. Actualizar el estado de la invitación
  const { data, error } = await supabase
    .from('equipo_invitaciones')
    .update({ status: 'rejected', responded_at: new Date() })
    .eq('id', invitationId)
    .select()
    .single()

  if (error) throw error

  // 3. Crear notificación para el dueño de la empresa
  if (invitation?.empresa?.usuario_id) {
    // Obtener email del dueño
    const { data: ownerData, error: ownerError } = await supabase
      .from('usuarios')
      .select('email')
      .eq('id', invitation.empresa.usuario_id)
      .single()

    if (!ownerError && ownerData?.email) {
      await supabase
        .from('notificaciones')
        .insert({
          usuario_email: ownerData.email,
          type: 'invitation_response',
          title: `${invitation.invited_nombre || invitation.invited_email} rechazó tu invitación`,
          message: `${invitation.invited_nombre || invitation.invited_email} ha rechazado la invitación a ${invitation.equipo?.nombre_equipo || 'tu equipo'}.`,
          data: {
            response: 'rejected',
            invited_nombre: invitation.invited_nombre,
            invited_email: invitation.invited_email,
            empresa_nombre: invitation.empresa.nombre_empresa,
            equipo_nombre: invitation.equipo?.nombre_equipo
          }
        })
    }
  }

  return data
}
