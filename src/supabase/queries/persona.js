import { supabase } from "../client"

export const getPersonas = () =>
	supabase.from("persona").select("*")

export const getPersona = (id) =>
	supabase.from("persona").select("*").eq("id", id).single()

export const createPersona = (payload) =>
	supabase.from("persona").insert(payload).select().single()

export const updatePersona = (id, payload) =>
	supabase.from("persona").update(payload).eq("id", id).select().single()

export const deletePersona = (id) =>
	supabase.from("persona").delete().eq("id", id)
