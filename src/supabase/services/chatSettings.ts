import { supabase } from '../client'

export async function getChatKeywords(empresaId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('chat_settings')
    .select('keywords')
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (error) throw error
  return (data?.keywords || []) as string[]
}

export async function upsertChatKeywords(empresaId: string, keywords: string[]): Promise<string[]> {
  const { data, error } = await supabase
    .from('chat_settings')
    .upsert({ empresa_id: empresaId, keywords, updated_at: new Date().toISOString() }, { onConflict: 'empresa_id' })
    .select('keywords')
    .maybeSingle()
  if (error) throw error
  return (data?.keywords || []) as string[]
}
