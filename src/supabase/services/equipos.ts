import { supabase } from '../client'
import type { EquipoDB, CreateEquipoDTO } from '@/lib/types'

/**
 * Obtiene todos los equipos de una empresa
 */
export async function getEquipos(empresaId: string): Promise<EquipoDB[]> {
    console.log('[EQUIPOS] getEquipos empresaId', empresaId)
    const { data, error } = await supabase
        .from('equipos')
        .select('id, nombre_equipo, empresa_id, created_at')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('[EQUIPOS] error getEquipos', error)
        throw error
    }
    return data ?? []
}

interface CreateEquipoParams {
    nombre_equipo: string
    empresa_id: string
}

/**
 * Crea un nuevo equipo
 */
export async function createEquipo({ nombre_equipo, empresa_id }: CreateEquipoParams): Promise<EquipoDB> {
    const insertPayload = { nombre_equipo, empresa_id }
    console.log('[EQUIPOS] createEquipo payload', insertPayload)

    const { data, error } = await supabase
        .from('equipos')
        .insert(insertPayload)
        .select('id, nombre_equipo, empresa_id, created_at')
        .single()

    if (error) {
        console.error('[EQUIPOS] error createEquipo', error)
        throw error
    }
    return data
}

/**
 * Elimina un equipo
 */
export async function deleteEquipo(id: string): Promise<boolean> {
    console.log('[EQUIPOS] deleteEquipo', id)
    const { error } = await supabase
        .from('equipos')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('[EQUIPOS] error deleteEquipo', error)
        throw error
    }
    return true
}
