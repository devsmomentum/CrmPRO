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

    const normalizedEmail = (email || '').trim().toLowerCase();

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Buscar si el usuario existe en la tabla usuarios (o auth.users)
    // Asumimos que la tabla 'usuarios' tiene el email, o buscamos en auth.users si tenemos acceso
    // Vamos a buscar en la tabla 'usuarios' pública que debería estar sincronizada
    const { data: existingUser, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id, email")
      .eq("email", normalizedEmail)
      .single();

    if (userError || !existingUser) {
      throw new Error("El usuario no está registrado en el sistema. Solo se pueden invitar usuarios existentes.");
    }

    // 1.1.a Validar duplicados: ya miembro de la empresa (por usuario_id para evitar diferencias de mayúsculas en email)
    const { data: existingMember, error: memberError } = await supabaseAdmin
      .from('empresa_miembros')
      .select('id')
      .eq('empresa_id', companyId)
      .eq('usuario_id', existingUser.id)
      .maybeSingle();

    if (memberError) {
      throw new Error(memberError.message || 'Error verificando miembros existentes');
    }
    if (existingMember) {
      throw new Error('Esa persona ya es miembro de la empresa');
    }

    // 1.1.b Validar si es el dueño (owner) de la empresa
    const { data: empresaOwner, error: ownerError } = await supabaseAdmin
      .from('empresa')
      .select('id')
      .eq('id', companyId)
      .eq('usuario_id', existingUser.id)
      .maybeSingle();

    if (ownerError) {
      throw new Error(ownerError.message || 'Error verificando dueño de la empresa');
    }
    if (empresaOwner) {
      throw new Error('Esa persona ya es miembro (owner) de la empresa');
    }

    // 1.2 Validar duplicados: invitación pendiente existente
    const { data: existingInvite, error: inviteCheckError } = await supabaseAdmin
      .from('equipo_invitaciones')
      .select('id')
      .eq('empresa_id', companyId)
      .eq('invited_email', normalizedEmail)
      .eq('status', 'pending')
      .maybeSingle();

    if (inviteCheckError) {
      throw new Error(inviteCheckError.message || 'Error verificando invitaciones existentes');
    }
    if (existingInvite) {
      throw new Error('Ya existe una invitación pendiente para este correo');
    }

    const token = crypto.randomUUID();

    // 2. Insertar en equipo_invitaciones
    const { error: dbError } = await supabaseAdmin
      .from("equipo_invitaciones")
      .insert({
        equipo_id: teamId,
        empresa_id: companyId,
        invited_email: normalizedEmail,
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
