import { supabase } from '../client'
import type { PersonaDB } from '@/lib/types'

interface CreatePersonaDTO {
    nombre: string
    email: string
    titulo_trabajo?: string
    equipo_id?: string | null
    permisos?: string[]
}

/**
 * Obtiene todas las personas de un equipo
 */
export async function getPersonas(equipo_id: string): Promise<PersonaDB[]> {
    const { data, error } = await supabase
        .from('persona')
        .select('*')
        .eq('equipo_id', equipo_id)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
}

/**
 * Crea una nueva persona
 */
export async function createPersona(payload: CreatePersonaDTO): Promise<PersonaDB> {
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

/**
 * Elimina una persona
 */
export async function deletePersona(id: string): Promise<boolean> {
    const { error } = await supabase
        .from('persona')
        .delete()
        .eq('id', id)

    if (error) throw error
    return true
}

/**
 * Actualiza una persona
 */
export async function updatePersona(id: string, updates: Partial<CreatePersonaDTO>): Promise<PersonaDB> {
    const { data, error } = await supabase
        .from('persona')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data
}
