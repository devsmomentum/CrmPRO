import { supabase } from "../client"

export const getPipelines = () =>
	supabase.from("pipeline").select("*")

export const getPipeline = (id) =>
	supabase.from("pipeline").select("*").eq("id", id).single()

export const createPipeline = (payload) =>
	supabase.from("pipeline").insert(payload).select().single()

export const updatePipeline = (id, payload) =>
	supabase.from("pipeline").update(payload).eq("id", id).select().single()

export const deletePipeline = (id) =>
	supabase.from("pipeline").delete().eq("id", id)
