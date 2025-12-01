import { supabase } from "../client";

export const getEquipos = (empresa_id) =>
  supabase.from("equipos").select("*").eq("empresa_id", empresa_id);

export const createEquipo = (payload) =>
  supabase.from("equipos").insert(payload).select().single();

export const updateEquipo = (id, payload) =>
  supabase.from("equipos").update(payload).eq("id", id).select().single();

export const deleteEquipo = (id) =>
  supabase.from("equipos").delete().eq("id", id);
