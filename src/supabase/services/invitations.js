import { supabase } from '../client'

export async function createInvitation(payload) {
    // payload: { equipo_id, empresa_id, invited_email, invited_nombre, invited_titulo_trabajo, pipeline_ids }
    const { data: { session } } = await supabase.auth.getSession()

    const response = await supabase.functions.invoke('invite-member', {
        body: {
            teamId: payload.equipo_id,
            companyId: payload.empresa_id,
            email: payload.invited_email,
            name: payload.invited_nombre,
            role: payload.invited_titulo_trabajo,
            pipelineIds: payload.pipeline_ids
        },
        headers: {
            Authorization: `Bearer ${session?.access_token}`
        }
    })

    if (response.error) throw new Error(response.error.message || 'Error creating invitation')
    return response.data
}

export async function getPendingInvitations(email) {
    const { data, error } = await supabase
        .from('equipo_invitaciones')
        .select(`
      *,
      empresa:empresa_id (nombre_empresa),
      equipo:equipo_id (nombre_equipo)
    `)
        .eq('invited_email', email)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
}

export async function acceptInvitation(token, userId) {
    const { data: { session } } = await supabase.auth.getSession()

    const response = await supabase.functions.invoke('accept-invite', {
        body: {
            token,
            userId
        },
        headers: {
            Authorization: `Bearer ${session?.access_token}`
        }
    })

    if (response.error) throw new Error(response.error.message || 'Error accepting invitation')
    return response.data
}

export async function rejectInvitation(invitationId) {
    const { data, error } = await supabase
        .from('equipo_invitaciones')
        .update({ status: 'rejected', responded_at: new Date() })
        .eq('id', invitationId)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function getTeamInvitations(companyId) {
    const { data, error } = await supabase
        .from('equipo_invitaciones')
        .select('*')
        .eq('empresa_id', companyId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
}

export async function getPendingInvitationsByCompany(companyId) {
    const { data, error } = await supabase
        .from('equipo_invitaciones')
        .select(`
            *,
            empresa:empresa_id (nombre_empresa),
            equipo:equipo_id (nombre_equipo)
        `)
        .eq('empresa_id', companyId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
}
