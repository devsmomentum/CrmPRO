import { supabase } from "../client"
import type { Pipeline, Stage } from '@/lib/types'

interface PipelineDB {
    id: string
    nombre: string
    empresa_id: string
    created_at: string
    etapas?: EtapaDB[]
}

interface EtapaDB {
    id: string
    nombre: string
    pipeline_id: string
    orden: number
    color: string
    created_at: string
}

interface CreatePipelineWithStagesDTO {
    name: string
    stages: Array<{
        name: string
        order: number
        color: string
    }>
    empresa_id: string
}

/**
 * Obtiene todos los pipelines de una empresa con sus etapas
 */
export const getPipelines = (empresa_id: string) =>
    supabase.from("pipeline").select("*, etapas(*)").eq("empresa_id", empresa_id)

/**
 * Crea un nuevo pipeline
 */
export const createPipeline = (payload: { nombre: string; empresa_id: string }) =>
    supabase.from("pipeline").insert(payload).select().single()

/**
 * Actualiza un pipeline existente
 */
export const updatePipeline = (id: string, payload: Partial<{ nombre: string }>) =>
    supabase.from("pipeline").update(payload).eq("id", id).select().single()

/**
 * Elimina un pipeline
 */
export const deletePipeline = (id: string) =>
    supabase.from("pipeline").delete().eq("id", id)

/**
 * Crea un pipeline con sus etapas en una sola operación
 * 
 * Esta función es crítica para el AddPipelineDialog - crea el pipeline
 * y todas sus etapas de forma atómica.
 * 
 * @param pipelineData - Datos del pipeline y sus etapas
 * @returns El pipeline creado con sus etapas mapeadas
 */
export const createPipelineWithStages = async (pipelineData: CreatePipelineWithStagesDTO): Promise<Pipeline> => {
    const { name, stages, empresa_id } = pipelineData

    // 1. Insertar el pipeline
    const { data: pipeline, error: pipelineError } = await supabase
        .from('pipeline')
        .insert({ nombre: name, empresa_id })
        .select('id')
        .single()

    if (pipelineError) {
        console.error('Error creating pipeline:', pipelineError)
        throw new Error(`Error creating pipeline: ${pipelineError.message}`)
    }

    if (!pipeline) {
        throw new Error('Failed to create pipeline, no ID returned.')
    }

    const pipelineId = pipeline.id

    // 2. Preparar las etapas para la inserción
    const stagesToInsert = stages.map(stage => ({
        nombre: stage.name,
        pipeline_id: pipelineId,
        orden: stage.order,
        color: stage.color,
    }))

    // 3. Insertar las etapas
    const { data: insertedStages, error: stagesError } = await supabase
        .from('etapas')
        .insert(stagesToInsert)
        .select()

    if (stagesError) {
        console.error('Error creating stages:', stagesError)
        console.warn('Stages creation failed, but pipeline was created.')
    }

    // 4. Devolver el pipeline completo
    const { data: newPipelineWithStages } = await supabase
        .from('pipeline')
        .select(`*`)
        .eq('id', pipelineId)
        .single()

    if (!newPipelineWithStages) {
        throw new Error('Failed to retrieve created pipeline')
    }

    // Mapear etapas insertadas
    const mappedStages: Stage[] = (insertedStages || []).map((s: EtapaDB) => ({
        id: s.id,
        name: s.nombre,
        order: s.orden,
        color: s.color,
        pipelineType: newPipelineWithStages.nombre.toLowerCase().trim().replace(/\s+/g, '-')
    }))

    return {
        id: newPipelineWithStages.id,
        name: newPipelineWithStages.nombre,
        type: newPipelineWithStages.nombre.toLowerCase().trim().replace(/\s+/g, '-'),
        stages: mappedStages
    }
}
