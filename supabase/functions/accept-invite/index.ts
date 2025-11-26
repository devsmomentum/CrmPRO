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
    const { token, userId } = await req.json();

    // Usar Service Role para saltar RLS y ejecutar funciones admin
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Obtener la invitación primero para tener los pipeline_ids (ya que la RPC no los devuelve ni procesa)
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("equipo_invitaciones")
      .select("pipeline_ids")
      .eq("token", token)
      .single();

    if (inviteError) throw new Error("Invitación no encontrada");

    // 2. Llamar a la función RPC accept_invitation
    const { data: rpcResult, error: rpcError } = await supabaseAdmin
      .rpc('accept_invitation', {
        invite_token: token,
        current_user_id: userId
      });

    if (rpcError) throw rpcError;

    const memberId = rpcResult.member_id;

    // 3. Asignar a pipelines si existen
    if (invite.pipeline_ids && invite.pipeline_ids.length > 0) {
      const pipelineInserts = invite.pipeline_ids.map((pipelineId: string) => ({
        persona_id: memberId,
        pipeline_id: pipelineId
      }));

      const { error: pipelineError } = await supabaseAdmin
        .from("persona_pipeline")
        .insert(pipelineInserts);

      if (pipelineError) {
        console.error("Error assigning pipelines:", pipelineError);
        // No fallamos la operación completa, solo logueamos
      }
    }

    // 4. Crear notificación de bienvenida
    await supabaseAdmin
      .from("notificaciones")
      .insert({
        usuario_email: (await supabaseAdmin.auth.admin.getUserById(userId)).data.user?.email,
        type: 'invitation_accepted',
        title: '¡Bienvenido al equipo!',
        message: 'Has aceptado la invitación exitosamente.',
        data: { memberId }
      });

    return new Response(JSON.stringify({ success: true, memberId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
