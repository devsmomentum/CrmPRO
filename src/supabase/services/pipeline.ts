import { supabase } from '../client'
import type { PipelineDB, CreatePipelineDTO } from '@/lib/types'

/**
 * Obtiene todos los pipelines de una empresa
 */
export async function getPipelines(empresaId: string): Promise<PipelineDB[]> {
    const { data, error } = await supabase
        .from('pipeline')
        .select('*')
        .eq('empresa_id', empresaId)

    if (error) throw error
    return data ?? []
}

/**
 * Crea un nuevo pipeline
 */
export async function createPipeline(pipeline: CreatePipelineDTO): Promise<PipelineDB> {
    const { data, error } = await supabase
        .from('pipeline')
        .insert(pipeline)
        .select()
        .single()

    if (error) throw error
    return data
}

/**
 * Elimina un pipeline
 */
export async function deletePipeline(id: string): Promise<boolean> {
    const { error } = await supabase
        .from('pipeline')
        .delete()
        .eq('id', id)

    if (error) throw error
    return true
}

/**
 * Obtiene un pipeline por su ID
 * 
 * Nota: Esta función fue agregada para completar el CRUD de pipelines.
 * Anteriormente existía en queries/pipeline.js (archivo obsoleto eliminado).
 */
export async function getPipelineById(id: string): Promise<PipelineDB | null> {
    const { data, error } = await supabase
        .from('pipeline')
        .select('*')
        .eq('id', id)
        .single()

    if (error) {
        if (error.code === 'PGRST116') return null // Not found
        throw error
    }
    return data
}

/**
 * Actualiza un pipeline existente
 * 
 * Nota: Esta función fue agregada para completar el CRUD de pipelines.
 * Anteriormente existía en queries/pipeline.js (archivo obsoleto eliminado).
 * 
 * @param id - UUID del pipeline a actualizar
 * @param updates - Campos a actualizar (nombre, tipo, etc.)
 * @returns El pipeline actualizado
 * 
 * @example
 * ```typescript
 * const updated = await updatePipeline('uuid-del-pipeline', { nombre: 'Nuevo Nombre' })
 * ```
 */
export async function updatePipeline(
    id: string,
    updates: Partial<Omit<CreatePipelineDTO, 'empresa_id'>>
): Promise<PipelineDB> {
    const { data, error } = await supabase
        .from('pipeline')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data
}
