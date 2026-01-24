import { supabase } from '../client'

interface PanelDB {
    id: string
    empresa_id: string
    created_at: string
    [key: string]: unknown
}

interface CreatePanelDTO {
    empresa_id: string
    [key: string]: unknown
}

/**
 * Obtiene el panel de una empresa
 */
export async function getPanel(empresaId: string): Promise<PanelDB[]> {
    const { data, error } = await supabase
        .from('panel')
        .select('*')
        .eq('empresa_id', empresaId)

    if (error) throw error
    return data ?? []
}

/**
 * Crea un nuevo panel
 */
export async function createPanel(panel: CreatePanelDTO): Promise<PanelDB> {
    const { data, error } = await supabase
        .from('panel')
        .insert(panel)
        .select()
        .single()

    if (error) throw error
    return data
}
