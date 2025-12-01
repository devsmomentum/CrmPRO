import { supabase } from "../client";

// obtener pipelines de una persona
export const getPipelinesForPersona = (persona_id) =>
  supabase
    .from("persona_pipeline")
    .select("pipeline_id")
    .eq("persona_id", persona_id);

// agregar persona a un pipeline
export const addPersonaToPipeline = (payload) =>
  supabase.from("persona_pipeline").insert(payload);

// eliminar relacion persona–pipeline
export const removePersonaFromPipeline = (persona_id, pipeline_id) =>
  supabase
    .from("persona_pipeline")
    .delete()
    .eq("persona_id", persona_id)
    .eq("pipeline_id", pipeline_id);
