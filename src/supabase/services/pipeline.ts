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
