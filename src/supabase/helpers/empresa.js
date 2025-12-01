import { supabase } from "../client";

export const getEmpresa = (id) =>
  supabase.from("empresa").select("*").eq("id", id).single();

export const getEmpresasByUser = (usuario_id) =>
  supabase.from("empresa").select("*").eq("usuario_id", usuario_id);

export const createEmpresa = (payload) =>
  supabase.from("empresa").insert(payload).select().single();

export const updateEmpresa = (id, payload) =>
  supabase.from("empresa").update(payload).eq("id", id).select().single();

export const deleteEmpresa = (id) =>
  supabase.from("empresa").delete().eq("id", id);
