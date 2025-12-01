import { supabase } from '../client'

export async function createUsuario({ id, email, nombre }) {
  const { data, error } = await supabase
    .from('usuarios')
    .insert({ id, email, nombre })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getUsuarioById(id) {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}
