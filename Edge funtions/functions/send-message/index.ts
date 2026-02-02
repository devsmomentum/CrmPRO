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

    currentStep = 'Crear Cliente Supabase';
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    currentStep = 'Parsear JSON';
    const body = await req.json();
    const { lead_id, content, channel, media } = body as {
      lead_id: string
      content?: string
      channel?: string
      media?: MediaPayload
    };

    currentStep = 'Buscar Lead';
    console.log(`[Debug] Buscando lead: ${lead_id}`);
    const { data: lead, error: leadError } = await supabaseClient
      .from('lead')
      .select('telefono, empresa_id')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead || !lead.telefono) throw new Error("Lead no encontrado o sin teléfono");

    currentStep = 'Preparar Super API';
    // Valores por defecto de entorno
    let SUPER_API_KEY = Deno.env.get('SUPER_API_SECRET_TOKEN');
    let CLIENT_ID = Deno.env.get('SUPER_API_CLIENT');

    // URL base por defecto
    let BASE_URL = "https://v4.iasuperapi.com/api/v1";

    const envUrl = Deno.env.get('SUPER_API_URL');
    if (envUrl && envUrl.length > 5 && envUrl !== '.') {
      BASE_URL = envUrl.replace(/\/$/, "");
    }

    // Intentar obtener credenciales específicas de la empresa (Multitenant)
    if (lead.empresa_id) {
      const { data: integration } = await supabaseClient
        .from('integraciones')
        .select('id')
        .eq('empresa_id', lead.empresa_id)
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

          const client = creds.find((c: any) => c.key === 'client')?.value;
          if (client) CLIENT_ID = client;

          const customUrl = creds.find((c: any) => c.key === 'api_url')?.value;
          if (customUrl && customUrl.length > 5 && customUrl !== '.') {
            BASE_URL = customUrl.replace(/\/$/, "");
          }
        }
      }
    }

    if (SUPER_API_KEY) {
      currentStep = 'Fetch Super API';

      let targetUrl = BASE_URL;

      // Validar CLIENT_ID si estamos usando la URL por defecto v4
      if (BASE_URL.includes("v4.iasuperapi.com") && !CLIENT_ID) {
        throw new Error("Falta configurar SUPER_API_CLIENT (Client ID) para usar la API v4");
      }

      // Lógica de construcción de URL: BASE_URL / CLIENT_ID / messages
      if (CLIENT_ID && !targetUrl.includes(CLIENT_ID)) {
        targetUrl = `${BASE_URL}/${CLIENT_ID}/messages`;
      } else {
        // Fallback: Si no hay cliente, intentamos asumir que BASE_URL ya incluía el path
        if (!targetUrl.endsWith('/messages')) {
          targetUrl = `${targetUrl}/messages`;
        }
      }

      console.log(`[Debug] Target URL calculada: ${targetUrl}`);

      let platform = 'wws';
      if (channel === 'instagram') platform = 'instagram';
      else if (channel) platform = channel;

      let chatId = String(lead.telefono || '');
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
        channel: channel || 'whatsapp',
        read: true,
        metadata
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