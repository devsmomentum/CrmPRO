import { supabase } from '../client'

export async function createEmpresa({ nombre_empresa, usuario_id }) {
  const { data, error } = await supabase
    .from('empresa')
    .insert({ nombre_empresa, usuario_id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getEmpresasByUsuario(usuario_id) {
  const { data, error } = await supabase
    .from('empresa')
    .select('*')
    .eq('usuario_id', usuario_id)
  if (error) throw error
  return data || []
}
