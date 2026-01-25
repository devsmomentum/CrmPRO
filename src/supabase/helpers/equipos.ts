import { supabase } from "../client"

interface CreateEquipoDTO {
    nombre_equipo: string
    empresa_id: string
}

interface UpdateEquipoDTO {
    nombre_equipo?: string
}

/**
 * Obtiene los equipos de una empresa
 */
export const getEquipos = (empresa_id: string) =>
    supabase.from("equipos").select("*").eq("empresa_id", empresa_id)

/**
 * Crea un nuevo equipo
 */
export const createEquipo = (payload: CreateEquipoDTO) =>
    supabase.from("equipos").insert(payload).select().single()

/**
 * Actualiza un equipo existente
 */
export const updateEquipo = (id: string, payload: UpdateEquipoDTO) =>
    supabase.from("equipos").update(payload).eq("id", id).select().single()

/**
 * Elimina un equipo
 */
export const deleteEquipo = (id: string) =>
    supabase.from("equipos").delete().eq("id", id)
