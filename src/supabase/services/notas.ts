import { supabase } from '../client'

/**
 * Obtener todas las notas de un lead
 */
export async function getNotasByLead(leadId: string) {
    const { data, error } = await supabase
        .from('nota_lead')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
}

/**
 * Crear una nueva nota para un lead
 */
export async function createNota(leadId: string, contenido: string, creadorNombre?: string) {
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
        .from('nota_lead')
        .insert({
            lead_id: leadId,
            contenido,
            creado_por: user?.id || null,
            creador_nombre: creadorNombre || null
        })
        .select()
        .single()

    if (error) throw error
    return data
}

/**
 * Eliminar una nota
 */
export async function deleteNota(notaId: string) {
    const { error } = await supabase
        .from('nota_lead')
        .delete()
        .eq('id', notaId)

    if (error) throw error
    return true
}

/**
 * Actualizar una nota
 */
export async function updateNota(notaId: string, contenido: string) {
    const { data, error } = await supabase
        .from('nota_lead')
        .update({ contenido })
        .eq('id', notaId)
        .select()
        .single()

    if (error) throw error
    return data
}
