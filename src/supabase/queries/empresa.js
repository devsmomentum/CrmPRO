import { supabase } from "@/lib/supabase";

// Obtener empresa del usuario actual
export const getEmpresa = async () => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) throw new Error("No authenticated user");

  return supabase
    .from("empresa")
    .select("*")
    .eq("usuario_id", userData.user.id)
    .single();
};

// Crear empresa
export const createEmpresa = (payload) =>
  supabase.from("empresa").insert(payload).select().single();

// Actualizar empresa
export const updateEmpresa = (id, payload) =>
  supabase.from("empresa").update(payload).eq("id", id).select().single();

// Eliminar empresa
export const deleteEmpresa = (id) =>
  supabase.from("empresa").delete().eq("id", id);

