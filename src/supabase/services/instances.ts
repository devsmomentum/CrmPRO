import { supabase } from '../client'
import type { EmpresaInstanciaDB } from '@/lib/types'

export async function listEmpresaInstancias(empresaId: string): Promise<EmpresaInstanciaDB[]> {
  if (!empresaId) return []
  const { data, error } = await supabase
    .from('empresa_instancias')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('plataforma', { ascending: true })
    .order('label', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function listWhatsappInstancias(empresaId: string): Promise<EmpresaInstanciaDB[]> {
  const { data, error } = await supabase
    .from('empresa_instancias')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('plataforma', 'whatsapp')
    .eq('active', true)
    .order('label', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function createEmpresaInstancia(payload: Omit<EmpresaInstanciaDB, 'id' | 'created_at' | 'updated_at'>): Promise<EmpresaInstanciaDB> {
  const { data, error } = await supabase
    .from('empresa_instancias')
    .insert(payload as any)
    .select('*')
    .single()
  if (error) throw error
  return data as EmpresaInstanciaDB
}

export async function updateEmpresaInstancia(id: string, updates: Partial<Omit<EmpresaInstanciaDB, 'id' | 'empresa_id'>>): Promise<EmpresaInstanciaDB> {
  const { data, error } = await supabase
    .from('empresa_instancias')
    .update(updates as any)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as EmpresaInstanciaDB
}

export async function deleteEmpresaInstancia(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('empresa_instancias')
    .delete()
    .eq('id', id)
  if (error) throw error
  return true
}
