import { supabase } from '../client'

export async function getLeads(empresaId) {
  const { data, error } = await supabase
    .from('lead')
    .select('*')
    .eq('empresa_id', empresaId)

  if (error) throw error
  return data
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
