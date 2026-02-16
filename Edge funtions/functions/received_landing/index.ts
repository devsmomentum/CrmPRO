// @deno-types="https://deno.land/std@0.177.0/http/server.ts"
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// @deno-types="https://esm.sh/@supabase/supabase-js@2"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore
declare const Deno: any;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type LandingLeadPayload = {
  nombre_completo: string;
  correo_electronico?: string;
  telefono?: string;
  empresa?: string;
  ubicacion?: string;
  presupuesto?: string | number;
  etapa_id?: string; // aqui id
  prioridad?: string;
  asignado_a?: string; // aqui sera 00000000-0000-0000-0000-000000000000
  evento?: string;
  empresa_id?: string; // aqui id
  pipeline_id?: string; // Aqui id
};

function normalizePhone(phone: string): string {
  return phone.replace("@c.us", "").replace("@s.whatsapp.net", "").replace(/[^\d]/g, "").trim();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(JSON.stringify({ success: true, message: "received_landing activo" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Supabase env vars are missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = (await req.json()) as LandingLeadPayload;

    if (!payload.telefono || !payload.empresa_id) {
      return new Response(JSON.stringify({ error: "telefono y empresa_id son obligatorios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanPhone = normalizePhone(payload.telefono);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase
      .from("lead")
      .insert({
        nombre_completo: payload.nombre_completo ?? `Lead Landing ${cleanPhone}`,
        correo_electronico: payload.correo_electronico ?? null,
        telefono: cleanPhone,
        empresa: payload.empresa ?? "Landing",
        ubicacion: payload.ubicacion ?? null,
        presupuesto: payload.presupuesto ?? null,
        empresa_id: payload.empresa_id ?? "39e9e5ca-859c-43e7-bdb7-1fb3aaa1db53",
        pipeline_id: payload.pipeline_id ?? "a8ba911a-9b30-460e-9082-519d9efcca0b",
        etapa_id: payload.etapa_id ?? "fefa1be0-256e-48fa-aae1-23a4363f6189",
        prioridad: "medium",
        asignado_a: "00000000-0000-0000-0000-000000000000",
      })
      .select("id")
      .single();

    if (error) {
     if ((error as any).code === "23505") {
    const { data: existingLead } = await supabase
      .from("lead")
      .select("id")
      .eq("empresa_id", payload.empresa_id!)
      .eq("telefono", cleanPhone)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Lead already exists",
        lead_id: existingLead?.id ?? null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

     return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    }

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, lead_id: data.id }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});