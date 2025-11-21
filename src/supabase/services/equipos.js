import { supabase } from '../client'

export async function getEquipos(empresaId) {
  const { data, error } = await supabase
    .from("equipos")
    .select("*")
    .eq("empresa_id", empresaId)

  if (error) throw error
  return data
}

export async function createEquipo(equipo) {
  const { data, error } = await supabase
    .from("equipos")
    .insert(equipo)
    .select()

  if (error) throw error
  return data[0]
}
