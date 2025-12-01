import { supabase } from '../client'

export async function getPersonas(equipo_id) {
  const { data, error } = await supabase
    .from('persona')
    .select('*')
    .eq('equipo_id', equipo_id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createPersona(payload) {
  // payload esperado: { nombre, email, titulo_trabajo, equipo_id, permisos? }
  // Nota: ignorar campos inexistentes en la tabla (avatar, roleId, pipelines, etc.)
  const insertPayload = {
    nombre: payload.nombre,
    email: payload.email,
    titulo_trabajo: payload.titulo_trabajo,
    equipo_id: payload.equipo_id || null,
    permisos: Array.isArray(payload.permisos) ? payload.permisos : []
  }
  const { data, error } = await supabase
    .from('persona')
    .insert(insertPayload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletePersona(id) {
  const { error } = await supabase
    .from('persona')
    .delete()
    .eq('id', id)
  if (error) throw error
  return true
}
