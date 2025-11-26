import { supabase } from '../client'
import { PipelineType } from '@/lib/types'

interface CreateInvitationPayload {
  equipo_id: string | null
  empresa_id?: string
  invited_email: string
  invited_nombre: string
  invited_titulo_trabajo: string
  pipeline_ids: Set<PipelineType>
}

export async function createInvitation(payload: CreateInvitationPayload) {
  const { data, error } = await supabase.functions.invoke('invite-member', {
    body: {
      email: payload.invited_email,
      teamId: payload.equipo_id,
      companyId: payload.empresa_id,
      name: payload.invited_nombre,
      role: payload.invited_titulo_trabajo,
      pipelineIds: Array.from(payload.pipeline_ids)
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
    const { data, error } = await supabase.rpc('accept_invitation', {
        invite_token: token,
        current_user_id: userId
    })

    if (error) throw error
    return data
}
