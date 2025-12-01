import { supabase } from "../client"

export const getPaneles = () =>
	supabase.from("panel").select("*")

export const getPanel = (id) =>
	supabase.from("panel").select("*").eq("id", id).single()

export const createPanel = (payload) =>
	supabase.from("panel").insert(payload).select().single()

export const updatePanel = (id, payload) =>
	supabase.from("panel").update(payload).eq("id", id).select().single()

export const deletePanel = (id) =>
	supabase.from("panel").delete().eq("id", id)
