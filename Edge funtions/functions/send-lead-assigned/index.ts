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
    const {
      leadId,
      leadName,
      empresaId,
      empresaNombre,
      assignedUserId,
      assignedUserEmail,
      assignedByEmail,
      assignedByNombre,
    } = await req.json();

    if (!assignedUserId || !leadId) {
      throw new Error("Faltan parámetros obligatorios: assignedUserId y leadId");
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Intentar obtener email del usuario asignado desde auth y/o tabla usuarios
    let recipientEmail: string | null = null;

    // 1) auth.admin
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(assignedUserId);
    recipientEmail = authUser?.user?.email || null;

    // 2) fallback a tabla usuarios por id
    if (!recipientEmail) {
      const { data: usuario } = await supabaseAdmin
        .from('usuarios')
        .select('email')
        .eq('id', assignedUserId)
        .single();
      recipientEmail = usuario?.email || null;
    }

    // 3) fallback final: usar email proporcionado
    if (!recipientEmail && assignedUserEmail) {
      recipientEmail = assignedUserEmail;
    }

    if (!recipientEmail) {
      throw new Error("No se pudo resolver el email del usuario asignado");
    }

    // Insertar notificación para el destinatario
    await supabaseAdmin
      .from('notificaciones')
      .insert({
        usuario_email: recipientEmail,
        type: 'lead_assigned',
        title: 'Te asignaron un lead',
        message: `Has sido asignado al lead ${leadName || ''}.`,
        data: {
          lead_id: leadId,
          empresa_id: empresaId,
          empresa_nombre: empresaNombre,
          assigned_by_email: assignedByEmail,
          assigned_by_nombre: assignedByNombre,
        }
      });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
