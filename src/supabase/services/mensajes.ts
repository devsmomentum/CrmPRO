import { supabase } from '../client'

export interface Message {
  id: string
  lead_id: string
  content: string
  sender: 'lead' | 'team'
  channel: string
  read: boolean
  created_at: string
  external_id?: string
  metadata?: any
}

export interface MediaPayload {
  downloadUrl: string
  fileName: string
}

// Subir archivo al bucket de Storage y obtener URL pública
export async function uploadChatAttachment(file: File, leadId: string): Promise<MediaPayload> {
  const ext = file.name.split('.').pop() || 'file'
  const fileName = `${leadId}-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('Send-message CRM')
    .upload(fileName, file, { upsert: true })

  if (uploadError) {
    console.error('[uploadChatAttachment] Error subiendo archivo:', uploadError)
    throw uploadError
  }

  const { data } = supabase.storage
    .from('Send-message CRM')
    .getPublicUrl(fileName)

  console.log('[uploadChatAttachment] Archivo subido:', { url: data.publicUrl, originalName: file.name })

  return { downloadUrl: data.publicUrl, fileName: file.name }
}

export async function getMessages(leadId: string) {
  const { data, error } = await supabase
    .from('mensajes')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data as Message[]
}

export async function sendMessage(
  leadId: string,
  content: string,
  sender: 'team' | 'lead' = 'team',
  channel: string = 'whatsapp',
  media?: MediaPayload
) {
  // Si es un mensaje del equipo, usamos la Edge Function para que también se envíe a la Super API
  if (sender === 'team') {
    // Enviar con esquema de fallback de autenticación como en invitations
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError
    const session = sessionData.session
    if (!session) throw new Error('Debes iniciar sesión para enviar mensajes')

    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
    if (!anonKey || !supabaseUrl) throw new Error('Faltan variables: VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY')

    const url = `${supabaseUrl}/functions/v1/send-message`
    const body = {
      lead_id: leadId,
      content: content || undefined,
      channel,
      media
    }

    const call = async (headers: Record<string, string>) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          ...headers,
        },
        body: JSON.stringify(body),
      })
      const rawText = await res.text()
      let data: any = {}
      try { data = rawText ? JSON.parse(rawText) : {} } catch { data = { raw: rawText } }
      return { res, data, rawText }
    }

    // Intento 1: Authorization = JWT del usuario
    const first = await call({ Authorization: `Bearer ${session.access_token}` })
    if (first.res.ok) return first.data as Message

    // Si no es 401, propagar el error
    if (first.res.status !== 401) {
      const sbRequestId = first.res.headers.get('sb-request-id') || first.res.headers.get('x-sb-request-id')
      const detail = first.data?.error || first.data?.message || first.rawText || ''
      throw new Error(`Edge Function send-message devolvió ${first.res.status}` + (sbRequestId ? ` (sb-request-id: ${sbRequestId})` : '') + (detail ? `: ${detail}` : ''))
    }

    // Intento 2: Authorization = anonKey; JWT del usuario en x-supabase-authorization
    const second = await call({ Authorization: `Bearer ${anonKey}`, 'x-supabase-authorization': `Bearer ${session.access_token}` })
    if (second.res.ok) return second.data as Message

    const sbRequestId = second.res.headers.get('sb-request-id') || second.res.headers.get('x-sb-request-id')
    const detail = second.data?.error || second.data?.message || second.rawText || ''
    throw new Error(`Edge Function send-message devolvió ${second.res.status}` + (sbRequestId ? ` (sb-request-id: ${sbRequestId})` : '') + (detail ? `: ${detail}` : ''))
  }

  // Si por alguna razón insertamos un mensaje manual como 'lead' (simulación), va directo a la BD
  const { data, error } = await supabase
    .from('mensajes')
    .insert({
      lead_id: leadId,
      content,
      sender,
      channel
    })
    .select()
    .single()

  if (error) throw error
  return data as Message
}

export function subscribeToMessages(leadId: string, onMessage: (msg: Message) => void) {
  // Suscripción sin filtro de servidor para evitar incompatibilidades.
  // Filtramos por lead_id en el cliente y añadimos logs de depuración.
  return supabase
    .channel(`messages:${leadId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'mensajes'
      },
      (payload) => {
        try {
          const msg = payload.new as Message
          // Debug: log en consola cada evento recibido
          console.log('[Realtime] INSERT mensajes payload:', payload)
          if ((msg as any)?.lead_id === leadId) {
            onMessage(msg)
          } else {
            // Debug: evento descartado por lead distinto
            console.log('[Realtime] descartado por lead_id distinto:', (msg as any)?.lead_id, '!=', leadId)
          }
        } catch (e) {
          console.error('[Realtime] error procesando payload de mensajes:', e, payload)
        }
      }
    )
    .subscribe()
}

export async function deleteMessage(messageId: string) {
  const { error } = await supabase
    .from('mensajes')
    .delete()
    .eq('id', messageId)

  if (error) throw error
}

export async function deleteConversation(leadId: string) {
  const { error } = await supabase
    .from('mensajes')
    .delete()
    .eq('lead_id', leadId)

  if (error) throw error
}

// Obtener conteo de mensajes no leídos para múltiples leads
export async function getUnreadMessagesCount(leadIds: string[]): Promise<Record<string, number>> {
  if (leadIds.length === 0) return {}

  const { data, error } = await supabase
    .from('mensajes')
    .select('lead_id')
    .in('lead_id', leadIds)
    .eq('sender', 'lead') // Solo mensajes del lead
    .eq('read', false)

  if (error) {
    console.error('[getUnreadMessagesCount] error:', error)
    return {}
  }

  // Contar mensajes por lead_id
  const counts: Record<string, number> = {}
  data.forEach((msg: any) => {
    counts[msg.lead_id] = (counts[msg.lead_id] || 0) + 1
  })

  return counts
}

// Marcar todos los mensajes de un lead como leídos
export async function markMessagesAsRead(leadId: string) {
  const { error } = await supabase
    .from('mensajes')
    .update({ read: true })
    .eq('lead_id', leadId)
    .eq('sender', 'lead') // Solo marcar mensajes del lead como leídos
    .eq('read', false)

  if (error) {
    console.error('[markMessagesAsRead] error:', error)
    throw error
  }
}

// Suscribirse a nuevos mensajes de lead (sender='lead') para toda la empresa
export function subscribeToAllMessages(callback: (msg: Message) => void) {
  return supabase
    .channel('all-messages')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'mensajes'
      },
      (payload) => {
        try {
          const msg = payload.new as Message
          // Notificar todos los nuevos mensajes (lead y team)
          callback(msg)
        } catch (e) {
          console.error('[Realtime] error procesando payload de mensajes:', e, payload)
        }
      }
    )
    .subscribe()
}

// Obtener el último mensaje por cada leadId proporcionado en una sola consulta
export async function getLastMessagesForLeadIds(leadIds: string[]) {
  if (!leadIds || leadIds.length === 0) return {} as Record<string, Message>

  const { data, error } = await supabase
    .from('mensajes')
    .select('*')
    .in('lead_id', leadIds)
    .order('created_at', { ascending: false })

  if (error) throw error

  const latestByLead: Record<string, Message> = {}
  for (const row of (data || []) as any[]) {
    const lid = row.lead_id as string
    if (!latestByLead[lid]) {
      latestByLead[lid] = row as unknown as Message
    }
  }
  return latestByLead
}
