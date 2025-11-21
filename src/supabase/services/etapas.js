import { supabase } from '../client'

export async function getEtapas(pipelineId) {
  const { data, error } = await supabase
    .from("etapas")
    .select("*")
    .eq("pipeline_id", pipelineId)

  if (error) throw error
  return data
}

export async function createEtapa(etapa) {
  const { data, error } = await supabase
    .from("etapas")
    .insert(etapa)
    .select()

  if (error) throw error
  return data[0]
}
