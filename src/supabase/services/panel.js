import { supabase } from '../client'

export async function getPanel(empresaId) {
  const { data, error } = await supabase
    .from("panel")
    .select("*")
    .eq("empresa_id", empresaId)

  if (error) throw error
  return data
}

export async function createPanel(panel) {
  const { data, error } = await supabase
    .from("panel")
    .insert(panel)
    .select()

  if (error) throw error
  return data[0]
}
