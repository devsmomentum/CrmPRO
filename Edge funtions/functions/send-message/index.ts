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
    let { data: instanceRow, error: instanceErr } = await supabaseClient
      .from('empresa_instancias')
      .select('id, empresa_id, plataforma, client_id, api_url, active, api_token')
      .eq('id', effectiveInstanceId)
      .maybeSingle();

    if (instanceErr) {
      console.error(`[Error] Fallo al buscar instancia: ${instanceErr.message}`, instanceErr);
      throw new Error(`Error en base de datos al buscar instancia: ${instanceErr.message}`);
    }

    // Si la instancia no existe o no está activa, buscar un fallback
    if (!instanceRow || !instanceRow.active) {
      console.warn(`⚠️ [Fallback] Instancia ${effectiveInstanceId} no encontrada o inactiva. Buscando alternativa...`);

      // Buscar cualquier instancia activa de la empresa para el canal
      const { data: fallbackInstances } = await supabaseClient
        .from('empresa_instancias')
        .select('id, empresa_id, plataforma, client_id, api_url, active, api_token')
        .eq('empresa_id', empresaId)
        .eq('plataforma', targetChannel === 'whatsapp' ? 'whatsapp' : targetChannel)
        .eq('active', true)
        .limit(1);

      if (!fallbackInstances || fallbackInstances.length === 0) {
        console.error(`❌ [Error] No hay instancias activas de ${targetChannel} para empresa ${empresaId}`);
        throw new Error(`No hay instancias de ${targetChannel} configuradas para esta empresa. Por favor configura una instancia en Configuración → Instancias.`);
      }

      instanceRow = fallbackInstances[0];
      effectiveInstanceId = instanceRow.id;
      console.log(`✅ [Fallback] Usando instancia alternativa: ${instanceRow.id} (${instanceRow.plataforma})`);

      // Actualizar preferred_instance_id del lead para futuras veces
      await supabaseClient
        .from('lead')
        .update({ preferred_instance_id: instanceRow.id })
        .eq('id', lead_id);

      console.log(`📝 [Fallback] Actualizado preferred_instance_id del lead a: ${instanceRow.id}`);
    }

    if (instanceRow.empresa_id !== empresaId) {
      console.error(`[Error] Conflicto de empresa. Instancia pertenece a ${instanceRow.empresa_id} pero el lead/petición dice ${empresaId}`);
      throw new Error('La instancia no pertenece a la empresa indicada');
    }

    currentStep = 'Preparar Super API';

    // ✅ ARQUITECTURA SIMPLIFICADA: Usar SOLO credenciales de la instancia
    const SUPER_API_KEY = (instanceRow as any).api_token;
    const CLIENT_ID = instanceRow.client_id;
    const BASE_URL = (instanceRow.api_url && instanceRow.api_url.length > 5 && instanceRow.api_url !== '.')
      ? instanceRow.api_url
      : "https://v4.iasuperapi.com";

    // Validar que la instancia tenga credenciales configuradas
    if (!SUPER_API_KEY) {
      throw new Error(`La instancia ${instanceRow.id} no tiene API Token configurado. Por favor configúralo en Configuración → Instancias.`);
    }

    if (!CLIENT_ID) {
      throw new Error(`La instancia ${instanceRow.id} no tiene Client ID configurado. Por favor configúralo en Configuración → Instancias.`);
    }

    console.log(`✅ [Credenciales] Usando instancia: ${instanceRow.id} (${instanceRow.plataforma})`);
    console.log(`✅ [Credenciales] Client ID: ${CLIENT_ID}`);



    if (SUPER_API_KEY) {
      currentStep = 'Fetch Super API';

      // Construir chatId correctamente según la plataforma
      let chatId = String((to && targetChannel === 'whatsapp') ? to : (lead.telefono || ''));

      // Para WhatsApp, limpiar el número de teléfono (solo dígitos)
      if (targetChannel === 'whatsapp' || targetChannel === 'wws') {
        chatId = chatId.replace(/\D/g, '');
        // Super API con platform 'wws' requiere el formato: numero@c.us
        // Ejemplo: 584143996158@c.us
        if (chatId && !chatId.includes('@')) {
          chatId = `${chatId}@c.us`;
        }
      }

      // Determinar plataforma según documentación Super API:
      // wws = WhatsApp Web (Super API), api = WhatsApp Cloud API (Meta), instagram, facebook
      // Por defecto usamos 'wws' que es el más común con Super API
      let platform = 'wws'; // WhatsApp Web (Super API) por defecto
      if (targetChannel === 'instagram') platform = 'instagram';
      else if (targetChannel === 'facebook') platform = 'facebook';
      else if (targetChannel === 'api') platform = 'api'; // Solo si explícitamente es Meta Cloud API
      // Si targetChannel es 'whatsapp', se queda en 'wws'

      console.log(`[Debug] ChatId construido: ${chatId}`);
      console.log(`[Debug] Platform: ${platform}`);
      console.log(`[Debug] CLIENT_ID: ${CLIENT_ID}`);

      // Según documentación Super API:
      // POST https://v4.iasuperapi.com/api/v1/send-message
      // Body: { chatId, message, platform, client, media }
      const apiPayload: any = {
        chatId,          // Obligatorio: número de teléfono
        message: content, // Mensaje de texto
        platform,        // wws, instagram, facebook, api
        client: CLIENT_ID // Cliente en SuperAPI (de la sección instancias)
      };

      // Agregar media si existe
      if (media?.downloadUrl) {
        apiPayload.media = {
          downloadUrl: media.downloadUrl,
          fileName: media.fileName || 'file'
        };
      }

      // URL correcta según documentación: /api/v1/send-message
      const domainOnly = BASE_URL.includes("v4.iasuperapi.com")
        ? "https://v4.iasuperapi.com"
        : BASE_URL.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");

      const sendMessageUrl = `${domainOnly}/api/v1/send-message`;

      console.log(`[Debug] URL: ${sendMessageUrl}`);
      console.log(`[Debug] Payload:`, JSON.stringify(apiPayload));

      const response = await fetch(sendMessageUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPER_API_KEY}`
        },
        body: JSON.stringify(apiPayload)
      });

      console.log(`[Super API] Status: ${response.status} ${response.statusText}`);

      const responseData = await response.json().catch(() => ({}));
      console.log(`[Super API] Response Body:`, JSON.stringify(responseData, null, 2));

      // Verificar si Super API retornó un error en el body aunque el HTTP sea 200
      if (responseData.error || responseData.status === 'error' || !response.ok) {
        const errorMsg = responseData.message || responseData.error || `HTTP ${response.status}`;
        console.error(`[Super API Error] ${errorMsg}`);
        throw new Error(`Super API Error: ${errorMsg}`);
      }

      // Verificar si el mensaje fue enviado exitosamente
      if (responseData.status === 'success' || responseData.sent) {
        console.log(`✅ [Super API] Mensaje enviado exitosamente`);
      } else {
        console.warn(`⚠️ [Super API] Respuesta inesperada:`, responseData);
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