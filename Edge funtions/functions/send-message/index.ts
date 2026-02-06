import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-supabase-authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface MediaPayload {
  downloadUrl: string
  fileName: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let currentStep = 'Inicio';

  try {
    currentStep = 'Validar Entorno';
    // SUPABASE_URL y KEY son obligatorias para el cliente
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log(`[Debug] SUPABASE_URL: '${supabaseUrl}'`);

    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Faltan variables de entorno de Supabase");
    if (supabaseUrl === '.') throw new Error("SUPABASE_URL es '.' (inválido)");

    currentStep = 'Verificar Autenticación';
    // Obtener el JWT del header de autorización
    const authHeader = req.headers.get('Authorization');

    // Crear cliente autenticado para verificar el usuario
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {}
      }
    });

    // Verificar que el usuario esté autenticado
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('[Auth] Usuario no autenticado:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized - user not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[Auth] Usuario autenticado: ${user.id}`);

    currentStep = 'Parsear JSON';
    const body = await req.json();
    const { lead_id, companyId, content, channel, media, instanceId, replyToMessageId, to } = body as {
      lead_id: string
      companyId?: string
      content?: string
      channel?: string
      media?: MediaPayload
      instanceId?: string
      replyToMessageId?: string
      to?: string
    };

    currentStep = 'Buscar Lead';
    console.log(`[Debug] Buscando lead: ${lead_id}`);
    const { data: lead, error: leadError } = await supabaseClient
      .from('lead')
      .select('id, telefono, empresa_id, preferred_instance_id')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) throw new Error("Lead no encontrado");
    if (!lead.telefono && (channel ?? 'whatsapp') === 'whatsapp' && !to) {
      throw new Error("Lead sin teléfono y sin 'to' para WhatsApp");
    }

    const empresaId = companyId || lead.empresa_id;
    if (!empresaId) throw new Error('Falta companyId/empresa_id');

    // Resolver instancia a usar
    currentStep = 'Resolver Instancia';

    const targetChannel = (channel || 'whatsapp').toLowerCase();

    // 1) Si especifican replyToMessageId intentamos heredar la instancia del mensaje anterior (desde metadata)
    async function resolveInstanceFromReply(): Promise<string | null> {
      if (!replyToMessageId) return null;
      const { data } = await supabaseClient
        .from('mensajes')
        .select('metadata')
        .eq('id', replyToMessageId)
        .maybeSingle();
      const meta = (data?.metadata || {}) as any;
      return meta?.instanceId || meta?.instance_id || null;
    }

    // 2) Si envían instanceId explícito, lo usamos
    let effectiveInstanceId: string | null = instanceId || null;
    if (effectiveInstanceId) console.log(`[Debug] Instancia recibida en body: ${effectiveInstanceId}`);

    if (!effectiveInstanceId) {
      effectiveInstanceId = await resolveInstanceFromReply();
      if (effectiveInstanceId) console.log(`[Debug] Instancia resuelta de replyToMessageId: ${effectiveInstanceId}`);
    }

    // 3) Si no hay aún, buscar la instancia del último mensaje recibido de ESTE lead
    if (!effectiveInstanceId) {
      const { data: lastInbound } = await supabaseClient
        .from('mensajes')
        .select('metadata')
        .eq('lead_id', lead_id)
        .eq('sender', 'lead')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastMeta = (lastInbound?.metadata || {}) as any;
      effectiveInstanceId = lastMeta?.instanceId || lastMeta?.instance_id || null;
      if (effectiveInstanceId) console.log(`[Debug] Instancia resuelta del último mensaje: ${effectiveInstanceId}`);
    }

    // 4) Si sigue sin haber, usar preferred_instance_id (ahora para cualquier canal)
    if (!effectiveInstanceId) {
      effectiveInstanceId = lead.preferred_instance_id || null;
      if (effectiveInstanceId) console.log(`[Debug] Instancia resuelta de preferred_instance_id: ${effectiveInstanceId}`);
    }

    // Función de limpieza para IDs resueltos
    function isValidId(id: any): boolean {
      if (!id || typeof id !== 'string') return false;
      const clean = id.trim().toLowerCase();
      return clean !== '' && clean !== 'null' && clean !== 'undefined' && clean !== 'none';
    }

    if (!isValidId(effectiveInstanceId)) {
      effectiveInstanceId = null;
    }

    if (!effectiveInstanceId && targetChannel === 'whatsapp') {
      const { data: waInstances } = await supabaseClient
        .from('empresa_instancias')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('plataforma', 'whatsapp')
        .eq('active', true);
      if ((waInstances || []).length === 1) {
        effectiveInstanceId = waInstances![0].id;
        console.log(`[Debug] Instancia resuelta por descarte (única activa WA): ${effectiveInstanceId}`);
      }
    }

    if (!effectiveInstanceId) {
      throw new Error('No se pudo resolver la instancia. El lead no tiene mensajes previos ni instancia preferida.');
    }

    // Obtener instancia y credenciales
    console.log(`[Debug] Buscando detalles de instancia en DB con ID: ${effectiveInstanceId}`);
    const { data: instanceRow, error: instanceErr } = await supabaseClient
      .from('empresa_instancias')
      .select('id, empresa_id, plataforma, client_id, api_url, active')
      .eq('id', effectiveInstanceId)
      .maybeSingle();

    if (instanceErr) {
      console.error(`[Error] Fallo al buscar instancia: ${instanceErr.message}`, instanceErr);
      throw new Error(`Error en base de datos al buscar instancia: ${instanceErr.message}`);
    }

    if (!instanceRow) {
      console.error(`[Error] No se encontró ninguna fila en empresa_instancias para ID: ${effectiveInstanceId}`);
      throw new Error('Instancia no encontrada');
    }

    if (!instanceRow.active) throw new Error('La instancia seleccionada está deshabilitada');
    if (instanceRow.empresa_id !== empresaId) {
      console.error(`[Error] Conflicto de empresa. Instancia pertenece a ${instanceRow.empresa_id} pero el lead/petición dice ${empresaId}`);
      throw new Error('La instancia no pertenece a la empresa indicada');
    }

    currentStep = 'Preparar Super API';
    // Valores por defecto de entorno
    let SUPER_API_KEY = Deno.env.get('SUPER_API_SECRET_TOKEN');
    let CLIENT_ID = instanceRow.client_id || Deno.env.get('SUPER_API_CLIENT');

    // URL base por defecto
    let BASE_URL = (instanceRow.api_url && instanceRow.api_url.length > 5 && instanceRow.api_url !== '.')
      ? instanceRow.api_url
      : "https://v4.iasuperapi.com";

    const envUrl = Deno.env.get('SUPER_API_URL');
    if (!instanceRow.api_url && envUrl && envUrl.length > 5 && envUrl !== '.') {
      BASE_URL = envUrl;
    }

    // Intentar obtener credenciales específicas de la empresa (Multitenant)
    if (empresaId) {
      const { data: integration } = await supabaseClient
        .from('integraciones')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('provider', 'chat')
        .eq('status', 'active')
        .maybeSingle();

      if (integration) {
        const { data: creds } = await supabaseClient
          .from('integracion_credenciales')
          .select('key, value')
          .eq('integracion_id', integration.id);

        if (creds) {
          const apiToken = creds.find((c: any) => c.key === 'api_token' || c.key === 'token')?.value;
          if (apiToken) SUPER_API_KEY = apiToken;

          // Nota: CLIENT_ID ahora viene de la instancia, no de integracion_credenciales
          // Solo usamos api_url global si la instancia no tiene uno específico
          if (!instanceRow.api_url) {
            const customUrl = creds.find((c: any) => c.key === 'api_url')?.value;
            if (customUrl && customUrl.length > 5 && customUrl !== '.') {
              BASE_URL = customUrl;
            }
          }
        }
      }
    }

    if (SUPER_API_KEY) {
      currentStep = 'Fetch Super API';

      // Validar CLIENT_ID si estamos usando la URL por defecto v4
      if (BASE_URL.includes("v4.iasuperapi.com") && !CLIENT_ID) {
        throw new Error("Falta configurar SUPER_API_CLIENT (Client ID) para usar la API v4");
      }

      // Construcción correcta de URL para Super API v4:
      // Formato: https://v4.iasuperapi.com/CLIENT_ID/api/v1/messages

      let targetUrl: string;

      if (BASE_URL.includes("v4.iasuperapi.com")) {
        // Forzamos el dominio raíz para v4
        // El orden correcto para v4 es: /api/v1/{client_id}/messages
        const domainOnly = "https://v4.iasuperapi.com";
        targetUrl = `${domainOnly}/api/v1/${CLIENT_ID}/messages`;
        console.log(`[Debug] URL v4 final calculada: ${targetUrl}`);
      } else {
        // Para URLs personalizadas, normalizamos (quitamos /api/v1 y barras finales)
        const normalizedBase = BASE_URL.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
        if (CLIENT_ID && !normalizedBase.includes(CLIENT_ID)) {
          targetUrl = `${normalizedBase}/${CLIENT_ID}/messages`;
        } else {
          targetUrl = normalizedBase.endsWith('/messages') ? normalizedBase : `${normalizedBase}/messages`;
        }
      }

      console.log(`[Debug] Target URL calculada: ${targetUrl}`);

      let platform = 'whatsapp';
      if (targetChannel === 'instagram') platform = 'instagram';
      else if (targetChannel === 'facebook') platform = 'facebook';

      let chatId = String((to && targetChannel === 'whatsapp') ? to : (lead.telefono || ''));
      if (platform === 'wws') {
        chatId = chatId.replace(/\D/g, '');
        chatId = chatId.includes('@c.us') ? chatId : `${chatId}@c.us`;
      }

      const apiPayload: any = { chatId, platform, message: content };
      if (media?.downloadUrl) apiPayload.media = { downloadUrl: media.downloadUrl, fileName: media.fileName || 'file' };

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPER_API_KEY}` },
        body: JSON.stringify(apiPayload)
      });

      if (!response.ok) {
        const txt = await response.text();
        throw new Error(`Super API Error ${response.status} en ${targetUrl}: ${txt}`);
      }
    }

    currentStep = 'Guardar en DB';
    const finalContent = media ? (content ? `${content}\n${media.downloadUrl}` : media.downloadUrl) : content;
    const metadata = media ? { type: 'media', data: { mediaUrl: media.downloadUrl, fileName: media.fileName } } : null;

    const { data: message, error: insertError } = await supabaseClient
      .from('mensajes')
      .insert({
        lead_id,
        content: finalContent,
        sender: 'team',
        channel: targetChannel || 'whatsapp',
        read: true,
        metadata: {
          ...(metadata || {}),
          instanceId: effectiveInstanceId,
          platform: targetChannel,
        }
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(JSON.stringify(message), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error(`[Error Fatal] Paso: ${currentStep}. Detalle:`, error);
    return new Response(JSON.stringify({
      error: `[${currentStep}] ${error.message}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})