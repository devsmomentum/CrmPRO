import { supabase } from '../client'
import type { LeadHistory, CreateLeadHistoryDTO } from '@/lib/types'

/**
 * Crea una nueva entrada en el historial de la oportunidad
 */
export async function createHistoryEntry(entry: CreateLeadHistoryDTO): Promise<LeadHistory> {
    const { data, error } = await supabase
        .from('lead_historial')
        .insert(entry)
        .select()
        .single()

    if (error) {
        console.error('[createHistoryEntry] Error:', error)
        throw error
    }
    return data
}

/**
 * Obtiene el historial de una oportunidad con los nombres de los usuarios
 */
export async function getLeadHistory(leadId: string): Promise<LeadHistory[]> {
    const { data, error } = await supabase
        .from('lead_historial')
        .select(`
            *,
            usuarios:usuario_id (nombre)
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('[getLeadHistory] Error:', error)
        throw error
    }

    // Mapear el join para facilitar el uso en el frontend
    return (data || []).map(item => ({
        ...item,
        usuario_nombre: item.usuarios?.nombre || 'Sistema'
    }))
}
