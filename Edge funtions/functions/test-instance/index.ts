import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": [
    "authorization",
    "Authorization",
    "x-supabase-authorization",
    "X-Supabase-Authorization",
    "x-client-info",
    "X-Client-Info",
    "apikey",
    "Apikey",
    "content-type",
    "Content-Type"
  ].join(", "),
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(res: unknown, status = 200) {
  return new Response(JSON.stringify(res), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // Auth via Supabase JWT (same pattern as other functions)
    const authHeader = req.headers.get("x-supabase-authorization") ?? req.headers.get("Authorization") ?? req.headers.get("authorization");
    if (!authHeader) return json({ error: "Missing auth header (x-supabase-authorization or Authorization)" }, 401);

    const tokenJwt = authHeader.replace(/^Bearer\s+/i, '');
    let requester: { id: string; email?: string | null } | null = null;
    try {
      const parts = tokenJwt.split('.');
      if (parts.length !== 3) throw new Error('Malformed JWT');
      const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(payloadJson);
      requester = { id: payload.sub, email: payload.email };
      if (!requester.id) throw new Error('Missing sub in JWT');
    } catch (_) {
      return json({ error: 'Invalid token' }, 401);
    }

    let body: any;
    try {
      body = await req.json();
    } catch (_) {
      return json({ error: 'Invalid or missing JSON body' }, 400);
    }

    const { companyId, instanceId } = body || {};
    if (!companyId || !instanceId) return json({ error: 'Missing companyId or instanceId' }, 400);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Authorization: Owner or Admin of this company
    const { data: empresaRow, error: empresaError } = await supabaseAdmin
      .from('empresa')
      .select('usuario_id')
      .eq('id', companyId)
      .maybeSingle();

    if (empresaError || !empresaRow) return json({ error: 'Invalid companyId or company not found' }, 400);

    let isOwner = empresaRow.usuario_id === requester!.id;
    let isAdmin = false;

    if (!isOwner) {
      const { data: memberRow, error: memberCheckError } = await supabaseAdmin
        .from('empresa_miembros')
        .select('role')
        .eq('empresa_id', companyId)
        .eq('usuario_id', requester!.id)
        .maybeSingle();
      if (!memberCheckError && memberRow) isAdmin = memberRow.role === 'admin';
    }

    if (!isOwner && !isAdmin) return json({ error: 'Unauthorized: Only Admins or Owners can test instances' }, 403);

    // Load instance
    const { data: instanceRow, error: instErr } = await supabaseAdmin
      .from('empresa_instancias')
      .select('id, empresa_id, plataforma, client_id, api_url, label, active')
      .eq('id', instanceId)
      .eq('empresa_id', companyId)
      .maybeSingle();

    if (instErr) return json({ error: instErr.message }, 400);
    if (!instanceRow) return json({ error: 'Instance not found for this company' }, 404);

    // Resolve chat integration credentials for this company
    let credsMap: Record<string, string> = {};
    try {
      const { data: integration } = await supabaseAdmin
        .from('integraciones')
        .select('id')
        .eq('empresa_id', companyId)
        .eq('provider', 'chat')
        .maybeSingle();

      if (integration?.id) {
        const { data: creds } = await supabaseAdmin
          .from('integracion_credenciales')
          .select('key, value')
          .eq('integracion_id', integration.id);
        for (const c of (creds || []) as Array<{ key: string; value: string }>) {
          credsMap[c.key] = c.value;
        }
      }
    } catch (e) {
      // Non-fatal; fall back to env
    }

    const token = credsMap['token'] || credsMap['api_token'] || credsMap['secret'] || Deno.env.get('SUPER_API_SECRET_TOKEN');
    const baseUrl = (instanceRow.api_url && instanceRow.api_url.trim()) || Deno.env.get('SUPER_API_URL') || 'https://v4.iasuperapi.com/api/v1';
    const clientId = instanceRow.client_id;

    // Step 1: Connectivity check (no auth)
    let connectivity: { ok: boolean; status?: number; error?: string } = { ok: false };
    try {
      const res = await fetch(baseUrl, { method: 'GET' });
      connectivity = { ok: true, status: res.status };
    } catch (e: any) {
      connectivity = { ok: false, error: e?.message || 'Network error' };
      return json({
        ok: false,
        step: 'connectivity',
        connectivity,
        resolved: { baseUrl, clientId, platform: instanceRow.plataforma, active: instanceRow.active },
        tokenPresent: !!token
      }, 200);
    }

    // Step 2: Auth check (attempt with Authorization header) using a conservative endpoint
    // We'll try common status endpoints; if none exist, any 2xx/3xx/4xx still proves reachability, and 401/403 indicates bad token
    const tryPaths = ['status', 'health'];
    let authCheck: { ok: boolean; status?: number; body?: string; hint?: string } = { ok: false };
    if (!token) {
      authCheck = { ok: false, hint: 'Missing token for SuperAPI (set in integraciones or env SUPER_API_SECRET_TOKEN)' };
    } else {
      for (const p of tryPaths) {
        const url = baseUrl.replace(/\/$/, '') + '/' + p;
        try {
          const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
          const text = await res.text().catch(() => '');
          if (res.status === 401 || res.status === 403) {
            authCheck = { ok: false, status: res.status, body: text, hint: 'Token inválido o sin permisos' };
            break;
          }
          // Consider any response here as OK for auth signal (even 404 means token accepted route but endpoint unknown)
          authCheck = { ok: true, status: res.status, body: text };
          break;
        } catch (e: any) {
          authCheck = { ok: false, hint: e?.message || 'Auth request failed' };
        }
      }
    }

    // Step 3: Client binding hint (we cannot guarantee endpoint path without docs; we just echo clientId)
    const result = {
      ok: connectivity.ok && (authCheck.ok || !token),
      connectivity,
      authCheck,
      resolved: { baseUrl, clientId, platform: instanceRow.plataforma, active: instanceRow.active, label: instanceRow.label },
      tokenPresent: !!token
    };

    return json(result, 200);
  } catch (error: any) {
    return json({ error: error?.message || 'Unexpected error' }, 400);
  }
});
