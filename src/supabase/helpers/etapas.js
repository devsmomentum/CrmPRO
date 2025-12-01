import { supabase } from "../client";

export const getEtapas = (pipeline_id) =>
  supabase.from("etapas").select("*").eq("pipeline_id", pipeline_id);

export const createEtapa = (payload) =>
  supabase.from("etapas").insert(payload).select().single();

export const updateEtapa = (id, payload) =>
  supabase.from("etapas").update(payload).eq("id", id).select().single();

export const deleteEtapa = (id) =>
  supabase.from("etapas").delete().eq("id", id);
