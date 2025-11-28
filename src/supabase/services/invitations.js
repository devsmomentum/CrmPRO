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
