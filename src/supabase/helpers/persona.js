import { supabase } from "../client";

export const getPersonas = (equipo_id) =>
  supabase.from("persona").select("*").eq("equipo_id", equipo_id);

export const createPersona = (payload) =>
  supabase.from("persona").insert(payload).select().single();

export const updatePersona = (id, payload) =>
  supabase.from("persona").update(payload).eq("id", id).select().single();

export const deletePersona = (id) =>
  supabase.from("persona").delete().eq("id", id);
