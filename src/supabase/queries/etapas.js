import { supabase } from "../client"

export const getEtapas = () =>
	supabase.from("etapas").select("*")

export const getEtapa = (id) =>
	supabase.from("etapas").select("*").eq("id", id).single()

export const createEtapa = (payload) =>
	supabase.from("etapas").insert(payload).select().single()

export const updateEtapa = (id, payload) =>
	supabase.from("etapas").update(payload).eq("id", id).select().single()

export const deleteEtapa = (id) =>
	supabase.from("etapas").delete().eq("id", id)
