import { supabase } from "../client"

interface PersonaPipelineRelation {
    persona_id: string
    pipeline_id: string
}

/**
 * Obtiene los IDs de pipelines asignados a una persona
 */
export const getPipelinesForPersona = (persona_id: string) =>
    supabase
        .from("persona_pipeline")
        .select("pipeline_id")
        .eq("persona_id", persona_id)

/**
 * Asigna una persona a un pipeline
 */
export const addPersonaToPipeline = (payload: PersonaPipelineRelation) =>
    supabase.from("persona_pipeline").insert(payload)

/**
 * Elimina la relación persona–pipeline
 */
export const removePersonaFromPipeline = (persona_id: string, pipeline_id: string) =>
    supabase
        .from("persona_pipeline")
        .delete()
        .eq("persona_id", persona_id)
        .eq("pipeline_id", pipeline_id)
