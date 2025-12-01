import { supabase } from "../client";

/**
 * Inicia sesión con email y contraseña
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data.user;
}

/**
 * Registra un nuevo usuario con email y contraseña
 */
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) throw error;
  return data.user;
}

/**
 * Cierra sesión del usuario actual
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;

  return true;
}
