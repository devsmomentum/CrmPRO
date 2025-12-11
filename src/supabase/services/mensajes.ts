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

export async function getMessages(leadId: string) {
  const { data, error } = await supabase
    .from('mensajes')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data as Message[]
}

export async function sendMessage(leadId: string, content: string, sender: 'team' | 'lead' = 'team', channel: string = 'whatsapp') {
  // Si es un mensaje del equipo, usamos la Edge Function para que también se envíe a la Super API
  if (sender === 'team') {
    const { data, error } = await supabase.functions.invoke('send-message', {
      body: {
        lead_id: leadId,
        content,
        channel
      }
    })
    // Debug: superficie la respuesta completa de la Edge Function
    if (error) {
      console.error('[sendMessage] Edge error send-message:', error)
      throw error
    }
    console.log('[sendMessage] Edge response send-message:', data)
    return data as Message
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
