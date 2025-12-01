import { supabase } from "../client";

export async function getUserById(id) {
  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function createUser(payload) {
  const { data, error } = await supabase
    .from("usuarios")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}
