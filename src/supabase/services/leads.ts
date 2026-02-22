import { supabase } from '../client'
import type {
    LeadDB,
    CreateLeadDTO,
    UpdateLeadDTO,
    PaginatedResponse,
    GetLeadsPagedOptions,
    SearchLeadsOptions
} from '@/lib/types'

/**
 * Obtiene todos los leads de una empresa
 */
export async function getLeads(
    empresaId: string,
    currentUserId?: string,
    isAdminOrOwner: boolean = false,
    includeArchived: boolean = false
): Promise<LeadDB[]> {
    let query = supabase
        .from('lead')
        .select('*')
        .eq('empresa_id', empresaId)

    if (!includeArchived) {
        query = query.eq('archived', false)
    }

    if (!isAdminOrOwner && currentUserId) {
        query = query.or(`asignado_a.eq.${currentUserId},asignado_a.eq.00000000-0000-0000-0000-000000000000,asignado_a.is.null`)
    }

    const { data, error } = await query

    if (error) throw error
    if (error) throw error
    return data ?? []
}

/**
 * Obtiene un lead por su ID
 */
export async function getLeadById(id: string): Promise<LeadDB | null> {
    const { data, error } = await supabase
        .from('lead')
        .select('*')
        .eq('id', id)
        .single()

    if (error) {
        console.error('[getLeadById] Error:', error)
        return null
    }
    return data
}

/**
 * Obtiene el conteo de leads de una empresa
 */
export async function getLeadsCount(empresaId: string): Promise<number> {
    const { count, error } = await supabase
        .from('lead')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)

    if (error) throw error
    return count ?? 0
}

/**
 * Obtiene leads paginados con filtros opcionales
 */
export async function getLeadsPaged(options: GetLeadsPagedOptions): Promise<PaginatedResponse<LeadDB>> {
    const {
        empresaId,
        currentUserId,
        isAdminOrOwner = false,
        limit = 200,
        offset = 0,
        pipelineId,
        stageId,
        order = 'desc',
        archived = false,
    } = options

    let query = supabase
        .from('lead')
        .select('*', { count: 'exact' })
        .eq('empresa_id', empresaId)

    if (archived === true) {
        query = query.eq('archived', true)
    } else if (archived === false) {
        query = query.eq('archived', false)
    }

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
    return { data: data ?? [], count }
}

/**
 * Busca leads por término
 */
export async function searchLeads(
    empresaId: string,
    searchTerm: string,
    options: SearchLeadsOptions = {}
): Promise<LeadDB[]> {
    if (!searchTerm || !empresaId) return []

    const {
        pipelineId,
        stageId,
        archived = false,
        limit = 50,
        order = 'desc',
    } = options

    let query = supabase
        .from('lead')
        .select('*')
        .eq('empresa_id', empresaId)

    if (archived === true) {
        query = query.eq('archived', true)
    } else if (archived === false) {
        query = query.eq('archived', false)
    }

    if (pipelineId) {
        query = query.eq('pipeline_id', pipelineId)
    }
    if (stageId) {
        query = query.eq('etapa_id', stageId)
    }

    query = query
        .or(
            `nombre_completo.ilike.%${searchTerm}%,telefono.ilike.%${searchTerm}%,correo_electronico.ilike.%${searchTerm}%,empresa.ilike.%${searchTerm}%`
        )
        .order('created_at', { ascending: order === 'asc' })
        .limit(limit)

    const { data, error } = await query

    if (error) throw error
    return data ?? []
}

/**
 * Crea un nuevo lead
 */
export async function createLead(lead: CreateLeadDTO): Promise<LeadDB> {
    const { data, error } = await supabase
        .from('lead')
        .insert(lead)
        .select()
        .single()

    if (error) throw error
    return data
}

/**
 * Crea múltiples leads en una sola operación
 */
export async function createLeadsBulk(leads: CreateLeadDTO[]): Promise<LeadDB[]> {
    const { data, error } = await supabase
        .from('lead')
        .insert(leads)
        .select()

    if (error) throw error
    return data ?? []
}

/**
 * Actualiza un lead
 */
export async function updateLead(id: string, updates: UpdateLeadDTO): Promise<LeadDB> {
    const { data, error } = await supabase
        .from('lead')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data
}

/**
 * Archiva o desarchiva un lead
 */
export async function setLeadArchived(id: string, archived: boolean): Promise<LeadDB> {
    const updates: UpdateLeadDTO = {
        archived,
        archived_at: archived ? new Date().toISOString() : null
    }
    return updateLead(id, updates)
}

/**
 * Elimina un lead
 */
export async function deleteLead(id: string): Promise<boolean> {
    const { error } = await supabase
        .from('lead')
        .delete()
        .eq('id', id)

    if (error) throw error
    return true
}
