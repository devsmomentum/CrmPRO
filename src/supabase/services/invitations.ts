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

async function invokeEdgeFunctionWithAuthFallback<T>(
  functionName: string,
  body: unknown,
  anonKey: string,
  accessToken: string,
  supabaseUrl: string
): Promise<T> {
  const url = `${supabaseUrl}/functions/v1/${functionName}`

  const call = async (headers: Record<string, string>) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        ...headers
      },
      body: JSON.stringify(body)
    })

    const rawText = await res.text()
    let data: any = {}
    try {
      data = rawText ? JSON.parse(rawText) : {}
    } catch {
      data = { raw: rawText }
    }

    return { res, data, rawText }
  }

  // Intento 1 (Verify JWT ON): Authorization = JWT del usuario
  const first = await call({ Authorization: `Bearer ${accessToken}` })
  if (first.res.ok) return first.data as T

  // Si no fue 401, no tiene sentido reintentar con otro esquema
  if (first.res.status !== 401) {
    const sbRequestId = first.res.headers.get('sb-request-id') || first.res.headers.get('x-sb-request-id')
    const detail = first.data?.error || first.data?.message || first.rawText || ''
    throw new Error(
      `Edge Function ${functionName} devolvió ${first.res.status}` +
        (sbRequestId ? ` (sb-request-id: ${sbRequestId})` : '') +
        (detail ? `: ${detail}` : '')
    )
  }

  // Intento 2 (Verify JWT OFF / gateway): Authorization = anonKey, user JWT en x-supabase-authorization
  const second = await call({
    Authorization: `Bearer ${anonKey}`,
    'x-supabase-authorization': `Bearer ${accessToken}`
  })
  if (second.res.ok) return second.data as T

  const sbRequestId = second.res.headers.get('sb-request-id') || second.res.headers.get('x-sb-request-id')
  const detail = second.data?.error || second.data?.message || second.rawText || ''
  throw new Error(
    `Edge Function ${functionName} devolvió ${second.res.status}` +
      (sbRequestId ? ` (sb-request-id: ${sbRequestId})` : '') +
      (detail ? `: ${detail}` : '')
  )
}

export async function createInvitation(payload: CreateInvitationPayload) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  const session = sessionData.session
  if (!session) throw new Error('Debes iniciar sesión para invitar miembros')

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!anonKey || !supabaseUrl) throw new Error('Faltan variables: VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY')

  return await invokeEdgeFunctionWithAuthFallback(
    'invite-member',
    {
      email: payload.invited_email,
      teamId: payload.equipo_id,
      companyId: payload.empresa_id,
      name: payload.invited_nombre,
      role: payload.invited_titulo_trabajo,
      pipelineIds: Array.from(payload.pipeline_ids),
      permissionRole: payload.permission_role || 'viewer'
    },
    anonKey,
    session.access_token,
    supabaseUrl
  )
}

export async function getPendingInvitations(email: string) {
  // Standard select (will lack names if RLS blocks, but we handle that in the view with Edge Function)
  const { data, error } = await supabase
    .from('equipo_invitaciones')
    .select(`
      *,
      empresa (
        nombre_empresa
      ),
      equipo:equipos (
        nombre_equipo
      )
    `)
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
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  const session = sessionData.session
  if (!session) throw new Error('Debes iniciar sesión para aceptar invitaciones')

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!anonKey || !supabaseUrl) throw new Error('Faltan variables: VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY')

  return await invokeEdgeFunctionWithAuthFallback(
    'accept-invite',
    { token, userId },
    anonKey,
    session.access_token,
    supabaseUrl
  )
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

export async function cancelInvitation(invitationId: string) {
  const { data, error } = await supabase
    .from('equipo_invitaciones')
    .update({ status: 'cancelled', responded_at: new Date() })
    .eq('id', invitationId)
    .select()
    .single()

  if (error) throw error
  return data
}
