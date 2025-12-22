import { supabase } from '../client'

export async function getLeads(empresaId, currentUserId, isAdminOrOwner = false) {
  let query = supabase
    .from('lead')
    .select('*')
    .eq('empresa_id', empresaId)

  if (!isAdminOrOwner && currentUserId) {
    // Mostrar solo mis leads y los asignados a todos (UUID nulo y también NULL por compatibilidad)
    query = query.or(`asignado_a.eq.${currentUserId},asignado_a.eq.00000000-0000-0000-0000-000000000000,asignado_a.is.null`)
  }

  const { data, error } = await query

  if (error) throw error
  return data
}

export async function getLeadsCount(empresaId) {
  const { count, error } = await supabase
    .from('lead')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)

  if (error) throw error
  return count
}

// Nuevo: obtención paginada y ordenada, con filtros opcionales
export async function getLeadsPaged({
  empresaId,
  currentUserId,
  isAdminOrOwner = false,
  limit = 200,
  offset = 0,
  pipelineId,
  stageId,
  order = 'desc',
} = {}) {
  let query = supabase
    .from('lead')
    .select('*', { count: 'exact' })
    .eq('empresa_id', empresaId)

  if (pipelineId) {
    query = query.eq('pipeline_id', pipelineId)
  }
  if (stageId) {
    query = query.eq('etapa_id', stageId)
  }

  if (!isAdminOrOwner && currentUserId) {
    query = query.or(`asignado_a.eq.${currentUserId},asignado_a.eq.00000000-0000-0000-0000-000000000000,asignado_a.is.null`)
  }

  query = query
    .order('created_at', { ascending: order === 'asc' })
    .range(offset, Math.max(0, offset + limit - 1))

  const { data, error, count } = await query
  if (error) throw error
  return { data, count }
}

export async function createLead(lead) {
  const { data, error } = await supabase
    .from('lead')
    .insert(lead)
    .select()
    .single()

  if (error) throw error
  return data

}

export async function createLeadsBulk(leads) {
  const { data, error } = await supabase
    .from('lead')
    .insert(leads)
    .select()

  if (error) throw error
  return data
}

export async function updateLead(id, updates) {
  const { data, error } = await supabase
    .from('lead')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteLead(id) {
  const { error } = await supabase
    .from('lead')
    .delete()
    .eq('id', id)

  if (error) throw error
  return true
}
