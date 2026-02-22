import { supabase } from "../client"

interface UpdatePersonaDTO {
    nombre?: string
    email?: string
    titulo_trabajo?: string
    equipo_id?: string | null
}

/**
 * Obtiene las personas de un equipo
 */
export const getPersonas = (equipo_id: string) =>
    supabase.from("persona").select("*").eq("equipo_id", equipo_id)

/**
 * Crea una nueva persona
 */
export const createPersona = (payload: {
    nombre: string
    email: string
    titulo_trabajo?: string
    equipo_id?: string | null
}) =>
    supabase.from("persona").insert(payload).select().single()

/**
 * Actualiza una persona existente
 */
export const updatePersona = (id: string, payload: UpdatePersonaDTO) =>
    supabase.from("persona").update(payload).eq("id", id).select().single()

/**
 * Elimina una persona
 */
export const deletePersona = (id: string) =>
    supabase.from("persona").delete().eq("id", id)
