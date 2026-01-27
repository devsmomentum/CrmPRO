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
    const { empresa_id, equipo_id } = await req.json();
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let empresa_nombre: string | null = null;
    let equipo_nombre: string | null = null;

    if (empresa_id) {
      const { data: emp } = await supabaseAdmin
        .from('empresa')
        .select('nombre_empresa')
        .eq('id', empresa_id)
        .maybeSingle();
      empresa_nombre = emp?.nombre_empresa || null;
    }

    if (equipo_id) {
      const { data: eq } = await supabaseAdmin
        .from('equipos')
        .select('nombre_equipo')
        .eq('id', equipo_id)
        .maybeSingle();
      equipo_nombre = eq?.nombre_equipo || null;
    }

    return new Response(JSON.stringify({ empresa_nombre, equipo_nombre }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
