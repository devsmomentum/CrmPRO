import { supabase } from '../client'

export async function getPipelines(empresaId) {
  const { data, error } = await supabase
    .from("pipeline")
    .select("*")
    .eq("empresa_id", empresaId)

  if (error) throw error
  return data
}

export async function createPipeline(pipeline) {
  const { data, error } = await supabase
    .from("pipeline")
    .insert(pipeline)
    .select()

  if (error) throw error
  return data[0]
}
