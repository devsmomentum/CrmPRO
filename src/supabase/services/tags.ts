import { supabase } from '../client'
import { Tag, LeadDB } from '@/lib/types'

/**
 * Obtiene todas las etiquetas únicas usadas en los leads de una empresa
 * "Virtual Master Table"
 */
export async function getAllUniqueTags(empresaId: string): Promise<Tag[]> {
    // Traemos solo la columna tags de los leads de la empresa
    const { data, error } = await supabase
        .from('lead')
        .select('tags')
        .eq('empresa_id', empresaId)
        .not('tags', 'is', null)

    if (error) {
        console.error('Error fetching tags:', error)
        return []
    }
    // console.log('[getAllUniqueTags] loaded tags data:', data)

    // Agregación en memoria
    const tagMap = new Map<string, Tag>()

    data.forEach((row: any) => {
        const tags = row.tags as Tag[]
        if (Array.isArray(tags)) {
            tags.forEach(tag => {
                // Usamos ID como clave única. Si hay colisión de IDs con datos diferentes,
                // la última versión prevalece (o podríamos ser más sofisticados)
                if (tag.id && !tagMap.has(tag.id)) {
                    tagMap.set(tag.id, tag)
                }
            })
        }
    })

    return Array.from(tagMap.values())
}

/**
 * Actualiza una etiqueta en TODOS los leads que la tengan
 * (Renombrar o cambiar color globalmente)
 */
export async function bulkUpdateTag(empresaId: string, tagId: string, updates: Partial<Omit<Tag, 'id'>>): Promise<void> {
    // 1. Obtener leads que tienen esta etiqueta
    // Postgres JSONB operator: tags @> '[{"id": "tagId"}]'
    const { data: leads, error: fetchError } = await supabase
        .from('lead')
        .select('id, tags')
        .eq('empresa_id', empresaId)
        .contains('tags', JSON.stringify([{ id: tagId }]))

    if (fetchError) throw fetchError
    if (!leads || leads.length === 0) return

    // 2. Preparar updates
    // Lamentablemente Supabase/Postgres no tiene un "UPDATE ... SET tags = REPLACE_IN_JSON_ARRAY..." nativo fácil
    // Así que lo hacemos iterativamente (o en batch si son pocos)

    // Para optimizar, procesaremos en paralelo con Promise.all (cuidado con rate limits si son miles)
    const updatePromises = leads.map(async (lead: any) => {
        const currentTags = lead.tags as Tag[]
        const newTags = currentTags.map(t =>
            t.id === tagId ? { ...t, ...updates } : t
        )

        return supabase
            .from('lead')
            .update({ tags: newTags })
            .eq('id', lead.id)
    })

    await Promise.all(updatePromises)
}

/**
 * Elimina una etiqueta de TODOS los leads
 */
export async function bulkDeleteTag(empresaId: string, tagId: string): Promise<void> {
    const { data: leads, error: fetchError } = await supabase
        .from('lead')
        .select('id, tags')
        .eq('empresa_id', empresaId)
        .contains('tags', JSON.stringify([{ id: tagId }]))

    if (fetchError) throw fetchError
    if (!leads || leads.length === 0) return

    const updatePromises = leads.map(async (lead: any) => {
        const currentTags = lead.tags as Tag[]
        const newTags = currentTags.filter(t => t.id !== tagId)

        return supabase
            .from('lead')
            .update({ tags: newTags })
            .eq('id', lead.id)
    })

    await Promise.all(updatePromises)
}

/**
 * Agrega una etiqueta a un lead específico (Helper)
 */
export async function addTagToLead(leadId: string, currentTags: Tag[], newTag: Tag) {
    // Evitar duplicados por ID
    if (currentTags.some(t => t.id === newTag.id)) return

    const updatedTags = [...currentTags, newTag]

    const { error } = await supabase
        .from('lead')
        .update({ tags: updatedTags })
        .eq('id', leadId)

    if (error) throw error
    return updatedTags
}

/**
 * Remueve una etiqueta de un lead específico (Helper)
 */
export async function removeTagFromLead(leadId: string, currentTags: Tag[], tagId: string) {
    const updatedTags = currentTags.filter(t => t.id !== tagId)

    const { error } = await supabase
        .from('lead')
        .update({ tags: updatedTags })
        .eq('id', leadId)

    if (error) throw error
    return updatedTags
}
