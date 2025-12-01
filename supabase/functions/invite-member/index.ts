import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, teamId, companyId, name, role, pipelineIds, permissionRole } = await req.json();

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Buscar si el usuario existe en la tabla usuarios (o auth.users)
    // Asumimos que la tabla 'usuarios' tiene el email, o buscamos en auth.users si tenemos acceso
    // Vamos a buscar en la tabla 'usuarios' pública que debería estar sincronizada
    const { data: existingUser, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id, email")
      .eq("email", email)
      .single();

    if (userError || !existingUser) {
      throw new Error("El usuario no está registrado en el sistema. Solo se pueden invitar usuarios existentes.");
    }

    const token = crypto.randomUUID();

    // 2. Insertar en equipo_invitaciones
    const { error: dbError } = await supabaseAdmin
      .from("equipo_invitaciones")
      .insert({
        equipo_id: teamId,
        empresa_id: companyId,
        invited_email: email,
        invited_usuario_id: existingUser.id, // Vinculamos directamente
        token: token,
        invited_nombre: name,
        invited_titulo_trabajo: role,
        permission_role: permissionRole || 'viewer',
        pipeline_ids: pipelineIds
      });

    return new Response(JSON.stringify({ message: "Invitación enviada exitosamente" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
