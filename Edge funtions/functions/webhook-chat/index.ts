// @deno-types="https://deno.land/std@0.168.0/http/server.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @deno-types="https://esm.sh/@supabase/supabase-js@2"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @deno-types="https://deno.land/std@0.177.0/crypto/mod.ts"
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";
// @ts-ignore
declare const Deno: any;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hub-signature-256, x-signature-256",
};

// Nombre del bucket para guardar archivos recibidos
const MEDIA_BUCKET = "CRM message received";

// Función helper para descargar archivo de URL y subirlo al bucket de Storage
async function downloadAndStoreMedia(
  supabase: ReturnType<typeof createClient>,
  originalUrl: string,
  leadId: string,
  fileName?: string | null,
  mimeType?: string | null
): Promise<string | null> {
  try {
    console.log(`📥 [STORAGE] Descargando archivo desde: ${originalUrl}`);

    // Descargar el archivo
    const response = await fetch(originalUrl);
    if (!response.ok) {
      console.error(`❌ [STORAGE] Error descargando archivo: ${response.status}`);
      return null;
    }

    const blob = await response.blob();
    console.log(`📥 [STORAGE] Archivo descargado: ${blob.size} bytes, tipo: ${blob.type}`);

    // Determinar extensión del archivo
    let extension = 'bin';
    const contentType = mimeType || blob.type || '';

    if (contentType.includes('image/jpeg') || contentType.includes('image/jpg')) extension = 'jpg';
    else if (contentType.includes('image/png')) extension = 'png';
    else if (contentType.includes('image/gif')) extension = 'gif';
    else if (contentType.includes('image/webp')) extension = 'webp';
    else if (contentType.includes('audio/ogg') || contentType.includes('audio/opus')) extension = 'ogg';
    else if (contentType.includes('audio/mpeg') || contentType.includes('audio/mp3')) extension = 'mp3';
    else if (contentType.includes('audio/wav')) extension = 'wav';
    else if (contentType.includes('audio/webm')) extension = 'webm';
    else if (contentType.includes('video/mp4')) extension = 'mp4';
    else if (contentType.includes('video/webm')) extension = 'webm';
    else if (contentType.includes('application/pdf')) extension = 'pdf';
    else if (fileName) {
      // Intentar obtener extensión del nombre original
      const parts = fileName.split('.');
      if (parts.length > 1) extension = parts.pop() || 'bin';
    }

    // Generar nombre único para el archivo
    const timestamp = Date.now();
    const storagePath = `${leadId}/${timestamp}.${extension}`;

    // Subir al bucket
    const { error: uploadError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(storagePath, blob, {
        contentType: contentType || 'application/octet-stream',
        upsert: true
      });

    if (uploadError) {
      console.error(`❌ [STORAGE] Error subiendo archivo:`, uploadError);
      return null;
    }

    // Obtener URL pública
    const { data: publicUrlData } = supabase.storage
      .from(MEDIA_BUCKET)
      .getPublicUrl(storagePath);

    const storedUrl = publicUrlData?.publicUrl;
    console.log(`✅ [STORAGE] Archivo guardado en bucket: ${storedUrl}`);

    return storedUrl;
  } catch (error) {
    console.error(`❌ [STORAGE] Error procesando archivo:`, error);
    return null;
  }
}

// Marca todos los mensajes entrantes de un lead como leídos
async function markLeadMessagesAsRead(
  supabase: ReturnType<typeof createClient>,
  leadId: string
) {
  try {
    const { error } = await supabase
      .from("mensajes")
      .update({ read: true })
      .eq("lead_id", leadId)
      .eq("sender", "lead")
      .eq("read", false);

    if (error) {
      console.error(`❌ [read-status] Error marcando mensajes de ${leadId}:`, error);
    } else {
      console.log(`✅ [read-status] Mensajes marcados como leídos para lead ${leadId}`);
    }
  } catch (err) {
    console.error(`❌ [read-status] Error inesperado con lead ${leadId}:`, err);
  }
}

// Función helper para obtener detalles del perfil de WhatsApp/SuperApi con token por empresa
async function fetchChatDetails(client: string, chatId: string, apiToken?: string): Promise<{ name: string; image?: string } | null> {
  try {
    console.log(`🔍 [PROFILE] Buscando nombre para ${chatId} usando client ${client}...`);

    if (!apiToken) {
      console.warn('[PROFILE] Falta apiToken para el cliente, se omite lookup de perfil');
      return null;
    }

    const response = await fetch(`https://v4.iasuperapi.com/api/v1/${client}/chats/${chatId}/details`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.warn(`⚠️ [PROFILE] Error API Status: ${response.status}`);
      console.warn(`⚠️ [PROFILE] Error Body Raw: ${errorBody}`);
      return null;
    }

    const json = await response.json();
    if (json && json.payload) {
      return json.payload;
    }
    return null;
  } catch (error) {
    console.error("❌ [PROFILE] Error fetching chat details:", error);
    return null;
  }
}

// Resolver empresa e instancia por webhook_secret — fuente única: empresa_instancias
async function resolveBySecret(
  supabase: ReturnType<typeof createClient>,
  secret: string,
  provider: string
): Promise<{ empresa_id: string; integracion_id: string; metadata?: any; apiToken?: string; instanciaId: string; instanceConfig: { auto_create_lead: boolean; default_pipeline_id: string | null; default_stage_id: string | null; default_lead_name: string; include_first_message: boolean } } | null> {
  if (!secret) return null;

  console.log(`🔍 [resolveBySecret] Buscando webhook_secret en empresa_instancias...`);

  const { data: instancia, error } = await supabase
    .from('empresa_instancias')
    .select('id, empresa_id, plataforma, api_token, auto_create_lead, default_pipeline_id, default_stage_id, default_lead_name, include_first_message')
    .eq('webhook_secret', secret)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('❌ [resolveBySecret] Error en query:', error);
    return null;
  }

  if (!instancia) {
    console.warn(`❌ [resolveBySecret] No se encontró instancia activa con ese webhook_secret`);
    return null;
  }

  // Obtener metadata de la integración de esta empresa (se mantiene para allowed_phone y otros)
  const { data: integracion } = await supabase
    .from('integraciones')
    .select('id, metadata')
    .eq('empresa_id', instancia.empresa_id)
    .eq('provider', provider)
    .maybeSingle();

  console.log(`✅ [resolveBySecret] Resolución exitosa - Empresa: ${instancia.empresa_id}, Instancia: ${instancia.id}`);
  console.log(`✅ [resolveBySecret] Instance config: auto_create=${instancia.auto_create_lead}, pipeline=${instancia.default_pipeline_id}, stage=${instancia.default_stage_id}`);

  return {
    empresa_id: instancia.empresa_id,
    integracion_id: integracion?.id || '',
    metadata: integracion?.metadata || {},
    apiToken: instancia.api_token || undefined,
    instanciaId: instancia.id,
    instanceConfig: {
      auto_create_lead: instancia.auto_create_lead !== false,
      default_pipeline_id: instancia.default_pipeline_id || null,
      default_stage_id: instancia.default_stage_id || null,
      default_lead_name: instancia.default_lead_name || 'Nuevo lead',
      include_first_message: instancia.include_first_message !== false,
    },
  };
}

// Resolver empresa por verify_token — fuente única: empresa_instancias
async function resolveByVerifyToken(
  supabase: ReturnType<typeof createClient>,
  verifyToken: string,
  provider: string
): Promise<{ empresa_id: string; integracion_id: string; metadata?: any; apiToken?: string; instanciaId: string } | null> {
  if (!verifyToken) return null;

  console.log(`🔍 [resolveByVerifyToken] Buscando verify_token en empresa_instancias...`);

  const { data: instancia, error } = await supabase
    .from('empresa_instancias')
    .select('id, empresa_id, plataforma, api_token')
    .eq('verify_token', verifyToken)
    .eq('active', true)
    .maybeSingle();

  if (error || !instancia) return null;

  const { data: integracion } = await supabase
    .from('integraciones')
    .select('id, metadata')
    .eq('empresa_id', instancia.empresa_id)
    .eq('provider', provider)
    .maybeSingle();

  console.log(`✅ [resolveByVerifyToken] Resolución exitosa - Empresa: ${instancia.empresa_id}`);

  return {
    empresa_id: instancia.empresa_id,
    integracion_id: integracion?.id || '',
    metadata: integracion?.metadata || {},
    apiToken: instancia.api_token || undefined,
    instanciaId: instancia.id,
  };
}

// Obtener palabras clave configuradas para una empresa
async function getEmpresaKeywords(
  supabase: ReturnType<typeof createClient>,
  empresaId: string
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('chat_settings')
      .select('keywords')
      .eq('empresa_id', empresaId)
      .maybeSingle();

    if (error) {
      console.warn(`[chat-settings] Error obteniendo keywords para empresa ${empresaId}:`, error);
      return [];
    }
    const keywords = (data?.keywords || []) as string[];
    return Array.isArray(keywords) ? keywords.filter(k => typeof k === 'string') : [];
  } catch (e) {
    console.warn(`[chat-settings] Excepción obteniendo keywords para empresa ${empresaId}:`, e);
    return [];
  }
}

// Decidir si mantener no leídos los mensajes del lead según palabras clave
// Decidir si marcar como leídos los mensajes del lead según palabras clave
async function shouldMarkAsReadForLead(
  supabase: ReturnType<typeof createClient>,
  empresaId: string,
  leadId: string
): Promise<boolean> {
  const keywords = await getEmpresaKeywords(supabase, empresaId);
  // Si no hay keywords configuradas, no hacemos nada (false)
  if (!keywords || keywords.length === 0) return false;

  try {
    // Buscar en los últimos 10 mensajes del lead
    const { data: recentMsgs, error } = await supabase
      .from('mensajes')
      .select('content')
      .eq('lead_id', leadId)
      .eq('sender', 'lead')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.warn(`[read-rule] Error consultando mensajes recientes del lead ${leadId}:`, error);
      return false;
    }

    const normalizedKeywords = keywords.map(k => k.trim().toLowerCase()).filter(Boolean);

    for (const m of recentMsgs || []) {
      const text = (m.content || '').toString().toLowerCase();
      if (!text) continue;

      if (normalizedKeywords.some(kw => text.includes(kw))) {
        console.log(`[read-rule] Coincidencia de palabra clave encontrada. Marcando como LEÍDO.`);
        return true;
      }
    }

    return false;
  } catch (e) {
    console.warn(`[read-rule] Excepción evaluando palabras clave para lead ${leadId}:`, e);
  }
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const secretToken = Deno.env.get("SUPER_API_SECRET_TOKEN") ?? "";
  const url = new URL(req.url);

  // 🔍 DEBUG: Log de URL completa y parámetros
  console.log("=".repeat(80));
  console.log("🔍 [DEBUG] NUEVA PETICIÓN AL WEBHOOK");
  console.log("=".repeat(80));
  console.log("📍 URL completa:", req.url);
  console.log("📍 Método:", req.method);
  console.log("📍 Query params:", Object.fromEntries(url.searchParams.entries()));

  // Modo prueba: permite auditar y previsualizar sin efectos (dry-run)
  const testMode = url.searchParams.get("test") === "true";
  const provider = 'chat';
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Leer secreto desde distintos parámetros y sanear posibles contaminaciones con query strings
  const rawSecretParam = url.searchParams.get("x-webhook-secret") || url.searchParams.get("secret") || url.searchParams.get("hub.verify_token") || url.searchParams.get("x-webhook-verify-token") || "";

  // 🔍 DEBUG: Log de extracción de secret
  console.log("🔍 [SECRET] Extrayendo secret de parámetros:");
  console.log("   - x-webhook-secret:", url.searchParams.get("x-webhook-secret"));
  console.log("   - secret:", url.searchParams.get("secret"));
  console.log("   - hub.verify_token:", url.searchParams.get("hub.verify_token"));
  console.log("   - x-webhook-verify-token:", url.searchParams.get("x-webhook-verify-token"));
  console.log("   ➡️ rawSecretParam:", rawSecretParam);

  let decodedSecretParam = rawSecretParam;
  try { decodedSecretParam = decodeURIComponent(rawSecretParam); } catch (_) { /* ignore */ }
  const cleanSecretParam = (decodedSecretParam || "").split("?")[0].trim();

  console.log("   ➡️ decodedSecretParam:", decodedSecretParam);
  console.log("   ➡️ cleanSecretParam:", cleanSecretParam);

  // Resolver empresa e instancia por webhook_secret — fuente única: empresa_instancias
  console.log("🔍 [SECRET] Resolviendo por webhook_secret:", cleanSecretParam);
  let resolved: any = await resolveBySecret(supabase, cleanSecretParam, provider);
  if (!resolved && decodedSecretParam && decodedSecretParam !== cleanSecretParam) {
    resolved = await resolveBySecret(supabase, decodedSecretParam, provider);
  }
  const empresaFromSecret = resolved?.empresa_id || null;
  const integracionId = resolved?.integracion_id || null;
  const integrationMetadata = resolved?.metadata || {};
  const apiTokenResolved = resolved?.apiToken;
  const instanciaIdFromSecret = resolved?.instanciaId || null;
  const instanceConfig = resolved?.instanceConfig || null;

  console.log("🔍 [DEBUG] integrationMetadata resolviendo:", JSON.stringify(integrationMetadata, null, 2));

  // 🔍 DEBUG: Log de resultado de resolución
  if (empresaFromSecret) {
    console.log("✅ [SECRET] Empresa resuelta por secret:", empresaFromSecret);
    console.log("✅ [SECRET] Integración ID:", integracionId);
  } else {
    console.warn("❌ [SECRET] NO se pudo resolver empresa por secret");
    console.warn("❌ [SECRET] Esto causará que se use el FALLBACK (primera empresa)");
  }
  try {
    if (req.method === "GET") {
      const verifyToken = cleanSecretParam ||
        url.searchParams.get("hub.verify_token") ||
        url.searchParams.get("x-webhook-verify-token");
      const challenge = url.searchParams.get("hub.challenge");
      const mode = url.searchParams.get("hub.mode");
      console.log('[GET Verification] verifyToken:', verifyToken, 'challenge:', challenge, 'mode:', mode);

      // Caso 1: Verificación estilo Facebook/Meta (con hub.mode, hub.challenge)
      if (challenge && mode === "subscribe") {
        if (!verifyToken) {
          return new Response("Missing verification token", {
            headers: corsHeaders,
            status: 400,
          });
        }

        // Intentar resolver por verify_token desde BD (empresa_instancias)
        const resolvedByVerify = await resolveByVerifyToken(supabase, (url.searchParams.get("hub.verify_token") || url.searchParams.get("x-webhook-verify-token") || ""), provider);
        const empresaFromVerify = resolvedByVerify?.empresa_id || null;

        if (empresaFromSecret || empresaFromVerify || verifyToken === secretToken) {
          // Auditoría de verificación
          if (empresaFromSecret || empresaFromVerify) {
            const empresaForAudit = empresaFromSecret || empresaFromVerify;
            const integracionForAudit = integracionId || resolvedByVerify?.integracion_id || null;
            await supabase.from('webhooks_entrantes').insert({
              integracion_id: integracionForAudit,
              empresa_id: empresaForAudit,
              provider,
              event: 'subscribe',
              payload: { query: Object.fromEntries(url.searchParams.entries()) },
              signature_valid: true,
              dedupe_key: null,
            });
          }
          console.log(`✅ Verificación exitosa, devolviendo challenge: ${challenge}`);
          return new Response(challenge, { headers: corsHeaders, status: 200 });
        } else {
          console.warn("❌ Token de verificación no válido");
          return new Response("Invalid verification token", {
            headers: corsHeaders,
            status: 403,
          });
        }
      }

      // Caso 2: Verificación simple (solo secret en URL, sin hub.challenge)
      // Esto es para SuperAPI y otros servicios que solo verifican conectividad
      if (verifyToken && !challenge) {
        console.log('[Simple Verification] Verificando secret:', verifyToken);

        // Verificar que el secret existe en la BD
        if (empresaFromSecret || verifyToken === secretToken) {
          console.log('✅ Verificación simple exitosa');

          // Auditoría
          if (empresaFromSecret) {
            await supabase.from('webhooks_entrantes').insert({
              integracion_id: integracionId,
              empresa_id: empresaFromSecret,
              provider,
              event: 'verification',
              payload: { query: Object.fromEntries(url.searchParams.entries()) },
              signature_valid: true,
              dedupe_key: null,
            });
          }

          return new Response(JSON.stringify({
            status: 'ok',
            message: 'Webhook verified successfully',
            timestamp: new Date().toISOString()
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          });
        } else {
          console.warn('❌ Secret no válido en verificación simple');
          return new Response(JSON.stringify({
            error: 'Invalid webhook secret'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
          });
        }
      }

      // Si es GET pero no cumplió ningun caso anterior
      return new Response("Missing or invalid verification parameters", {
        headers: corsHeaders,
        status: 400,
      });
    }

    if (req.method === "POST") {
      // 1. Leemos el body como TEXTO para poder verificar la firma (HMAC)
      const bodyText = await req.text();

      const signatureQuery =
        url.searchParams.get("x-hub-signature-256") ||
        url.searchParams.get("x-signature-256");
      const signatureHeader =
        req.headers.get("x-hub-signature-256") ||
        req.headers.get("x-signature-256");

      const receivedSignature = (signatureQuery || signatureHeader || "").replace(
        "sha256=",
        ""
      );

      console.log("Body text:", bodyText);

      if (!receivedSignature) {
        return new Response(JSON.stringify({ error: "Missing signature" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        });
      }

      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        // Usar el secreto saneado; si no, intentar verify_token de query; último recurso: env
        encoder.encode(cleanSecretParam || url.searchParams.get("hub.verify_token") || secretToken),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );

      const hashBuffer = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(bodyText)
      );

      const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // 2. Convertimos el texto a JSON para leer los datos
      const payload = JSON.parse(bodyText);
      const leadsProcessedInPhase1 = new Set<string>();

      // Obtener el número de WhatsApp configurado para producción
      // Nota: Al mezclar `??` con `||` se requieren paréntesis por reglas del runtime
      const configuredPhone = (integrationMetadata?.allowed_phone || Deno.env.get("WHATSAPP_PHONE_NUMBER")) ?? "";
      const cleanConfiguredPhone = configuredPhone.replace(/[\s\-\+\(\)]/g, "").trim();

      if (hashHex !== receivedSignature) {
        console.log(`⚠️ Signature Mismatch - verificando por número de teléfono...`);
        console.log(`Received signature: '${receivedSignature.substring(0, 20)}...'`);
        console.log(`Calculated: '${hashHex.substring(0, 20)}...'`);

        // Verificar si es mensaje de Instagram o respuesta de IA (no aplicar filtro de número WhatsApp)
        const platform = payload.platform ?? "";
        const isInstagramMessage = platform.toLowerCase() === "instagram";
        const isAiResponse = payload.event === "ai_response" || payload.event === "message_create";

        if (isInstagramMessage) {
          console.log(`📷 [INSTAGRAM] Mensaje de Instagram detectado - saltando validación de número WhatsApp`);
        }
        if (isAiResponse) {
          console.log(`🤖 [AI] Evento ai_response/message_create detectado - saltando validación de número WhatsApp`);
        }

        // Si la firma no coincide, verificamos que el mensaje sea de/para nuestro número de producción
        // PERO solo para WhatsApp saliente normal (no para Instagram ni para respuestas de IA)
        if (cleanConfiguredPhone && !isInstagramMessage && !isAiResponse) {
          const eventData = typeof payload.data === "string" ? JSON.parse(payload.data || "{}") : (payload.data ?? {});
          // Normalizar teléfonos: quitar @c.us, @s.whatsapp.net, espacios, guiones, +
          // y también quitar prefijo de país (58) para poder comparar con formato local (0414...)
          const normalizePhone = (p: string) => {
            let n = (p ?? "").replace("@c.us", "").replace("@s.whatsapp.net", "").replace(/[\s\-\+\(\)]/g, "").trim();
            // Si empieza con 58 y tiene más de 10 dígitos, quitar el 58 para comparar con formato 0XXXX
            if (n.startsWith("58") && n.length > 10) n = "0" + n.slice(2);
            return n;
          };
          const pTo = normalizePhone(eventData.to ?? payload.to ?? "");
          const pFrom = normalizePhone(eventData.from ?? payload.from ?? "");
          const normalizedConfiguredPhone = normalizePhone(configuredPhone);

          const isFromConfiguredPhone = pFrom.includes(normalizedConfiguredPhone) || normalizedConfiguredPhone.includes(pFrom);
          const isToConfiguredPhone = pTo.includes(normalizedConfiguredPhone) || normalizedConfiguredPhone.includes(pTo);

          if (!isFromConfiguredPhone && !isToConfiguredPhone) {
            console.log(`❌ Mensaje ignorado: no es de/para el número configurado (${normalizedConfiguredPhone})`);
            console.log(`   From: ${pFrom}, To: ${pTo}`);
            return new Response(JSON.stringify({ success: true, message: "Ignored - wrong phone number" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }
          console.log(`✅ Firma no coincide pero mensaje es de/para número configurado - procesando...`);
        } else if (!isInstagramMessage && !isAiResponse) {
          console.log(`⚠️ WHATSAPP_PHONE_NUMBER no configurado - procesando mensaje de todos modos`);
        }
      }
      console.log("📦 [WEBHOOK] Webhook payload completo:", JSON.stringify(payload, null, 2));

      // Resolver plataforma y client_id (para mapear instancia)
      const platformRaw = (payload.platform || (payload.data && payload.data.platform) || '').toString().toLowerCase();
      const platform = ['instagram', 'facebook', 'whatsapp'].includes(platformRaw) ? platformRaw : (platformRaw === 'wws' ? 'whatsapp' : 'whatsapp');
      const eventDataRaw = payload.data ?? {};
      const eventData =
        typeof eventDataRaw === "string"
          ? (() => { try { return JSON.parse(eventDataRaw); } catch (_) { return {}; } })()
          : eventDataRaw;
      const clientId = (eventData?.sender?.client) || payload?.sender?.client || eventData?.client || payload?.client || eventData?.client_id || payload?.client_id || null;

      // 🔍 DEBUG: Log detallado de client_id
      console.log('🔍 [DEBUG] Extrayendo client_id del payload:');
      console.log('   - eventData.sender?.client:', eventData?.sender?.client);
      console.log('   - payload.sender?.client:', payload?.sender?.client);
      console.log('   - eventData.client:', eventData?.client);
      console.log('   - payload.client:', payload?.client);
      console.log('   - eventData.client_id:', eventData?.client_id);
      console.log('   - payload.client_id:', payload?.client_id);
      console.log('   ➡️ clientId final:', clientId);

      // Intentar resolver instancia por client_id (si viene)
      let instanceResolved: { id: string; empresa_id: string; plataforma: string } | null = null;
      if (clientId) {
        console.log(`🔍 [INSTANCE] Buscando instancia con client_id: ${clientId}`);
        try {
          const { data: inst } = await supabase
            .from('empresa_instancias')
            .select('id, empresa_id, plataforma')
            .eq('client_id', String(clientId))
            .eq('active', true)
            .maybeSingle();
          if (inst) {
            instanceResolved = inst as any;
            console.log(`✅ [INSTANCE] Instancia encontrada: ${inst.id} para empresa: ${inst.empresa_id}`);
          } else {
            console.warn(`⚠️ [INSTANCE] No se encontró instancia activa con client_id: ${clientId}`);
          }
        } catch (e) {
          console.warn('[webhook] No se pudo resolver empresa_instancias por client_id:', e);
        }
      } else {
        console.warn('⚠️ [INSTANCE] No se pudo extraer client_id del payload');
      }

      // AUTO-APRENDIZAJE: Si no se resolvió instancia por client_id pero sí por webhook_secret,
      // y el payload trae un client_id, guardarlo automáticamente en la instancia correspondiente.
      if (!instanceResolved && instanciaIdFromSecret && clientId) {
        console.log(`🔄 [AUTO-LEARN] Guardando client_id "${clientId}" en instancia ${instanciaIdFromSecret} (aprendido del primer mensaje)`);
        try {
          const { data: updatedInst, error: updateErr } = await supabase
            .from('empresa_instancias')
            .update({ client_id: String(clientId) })
            .eq('id', instanciaIdFromSecret)
            .select('id, empresa_id, plataforma')
            .single();

          if (updateErr) {
            console.warn(`⚠️ [AUTO-LEARN] No se pudo guardar client_id:`, updateErr);
          } else if (updatedInst) {
            instanceResolved = updatedInst as any;
            console.log(`✅ [AUTO-LEARN] client_id guardado y instancia resuelta: ${updatedInst.id} para empresa: ${updatedInst.empresa_id}`);
          }
        } catch (e) {
          console.warn('[AUTO-LEARN] Error al guardar client_id:', e);
        }
      } else if (!instanceResolved && instanciaIdFromSecret) {
        // Resuelto por webhook_secret pero sin client_id en el payload: usar la instancia del secret
        console.log(`🔄 [AUTO-LEARN] Sin client_id en payload, usando instancia del webhook_secret: ${instanciaIdFromSecret}`);
        try {
          const { data: instBySecret } = await supabase
            .from('empresa_instancias')
            .select('id, empresa_id, plataforma')
            .eq('id', instanciaIdFromSecret)
            .maybeSingle();
          if (instBySecret) {
            instanceResolved = instBySecret as any;
            console.log(`✅ [AUTO-LEARN] Instancia resuelta por webhook_secret: ${instBySecret.id}`);
          }
        } catch (e) {
          console.warn('[AUTO-LEARN] Error al obtener instancia por secret:', e);
        }
      }

      // supabase ya creado arriba con service role
      // Registrar auditoría de webhook entrante
      try {
        await supabase.from('webhooks_entrantes').insert({
          integracion_id: integracionId,
          empresa_id: empresaFromSecret || null as any,
          provider,
          event: payload.event || eventData.event || 'message',
          payload,
          signature_valid: !!receivedSignature,
          dedupe_key: eventData.id || payload.id || null,
        });
      } catch (auditErr) {
        console.warn('[webhook audit] No se pudo registrar auditoría:', auditErr);
      }

      console.log("📦 [WEBHOOK] Event Data Keys:", Object.keys(eventData));

      // 1. Intentamos sacar el texto normal
      let content = eventData.body ?? payload.body ?? eventData.text ?? payload.text;

      const externalId = eventData.id ?? payload.id;

      // Super API usa 'file' en lugar de 'media'
      const file = eventData.file ?? payload.file;
      const media = eventData.media ?? payload.media;
      const type = eventData.type ?? payload.type; // image, video, audio, etc.

      // Log detallado para debugging de Super API
      console.log("📦 [WEBHOOK] Campos extraídos:", {
        content,
        externalId,
        type,
        hasFile: !!file,
        hasMedia: !!media,
        fileKeys: file ? Object.keys(file) : [],
        mediaType: typeof media
      });

      // 2. Intentamos buscar la URL del archivo multimedia
      let mediaUrl = null;
      let mediaId = null;
      let fileName = null;

      // Prioridad 1: Super API file structure
      if (file) {
        mediaUrl = file.downloadUrl || file.url;
        fileName = file.fileName;
        console.log("✅ [WEBHOOK] File de Super API encontrado:", {
          downloadUrl: file.downloadUrl,
          fileName: file.fileName,
          mimeType: file.mimeType
        });
      }

      // Prioridad 2: Estructura genérica 'media'
      if (!mediaUrl && typeof media === 'string' && media.startsWith('http')) {
        mediaUrl = media;
        console.log("📦 [WEBHOOK] Media es una URL directa:", mediaUrl);
      } else if (typeof media === 'object') {
        mediaUrl = media.url ||
          media.link ||
          media.file ||
          media.publicUrl ||
          media.downloadUrl ||
          (media.links && media.links.download) ||
          null;

        mediaId = media.id || media.mediaId || null;

        console.log("📦 [WEBHOOK] Media object:", {
          mediaUrl,
          mediaId,
          mediaKeys: Object.keys(media)
        });
      }

      // Si la API lo manda en el root
      if (!mediaUrl) {
        mediaUrl = eventData.mediaUrl ||
          payload.mediaUrl ||
          eventData.fileUrl ||
          payload.fileUrl ||
          eventData.url ||
          payload.url ||
          eventData.publicUrl ||
          payload.publicUrl;
      }

      console.log("📦 [WEBHOOK] URL final extraída:", mediaUrl);

      // Si el 'body' o 'content' es una URL y el tipo es media, úsalo como mediaUrl
      if (!mediaUrl && content && typeof content === 'string' && content.startsWith('http')) {
        const isMedia = type === 'image' || type === 'video' || type === 'audio' || type === 'document' || type === 'ptt';
        if (isMedia) {
          mediaUrl = content;
        }
      }

      // 3. Decidimos qué guardar en la base de datos
      if (mediaUrl) {
        if (content) {
          content = `${content} \n ${mediaUrl}`;
        } else {
          content = mediaUrl;
        }
        console.log("✅ [WEBHOOK] Se guardará la URL en content:", content);
      } else {
        if (!content && (file || media || type === 'image' || type === 'video' || type === 'audio' || type === 'document' || type === 'ptt')) {
          content = `📷 [Archivo ${type} recibido] (Sin URL pública)`;
          console.warn("⚠️ [WEBHOOK] No se encontró URL para tipo:", type);
        }
      }

      // Deduplicación: Verificar si ya existe el mensaje por external_id
      if (externalId) {
        const { data: existing } = await supabase
          .from("mensajes")
          .select("id")
          .eq("external_id", externalId)
          .maybeSingle();

        if (existing) {
          console.log(`Mensaje ${externalId} ya existe. Ignorando.`);
          return new Response(JSON.stringify({ success: true, message: "Duplicate" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }

      // Candidatos para buscar el lead
      const phoneCandidates = [] as { phone?: string | null; senderRole: "lead" | "team" }[];

      // Extraer posibles teléfonos
      const pTo = eventData.to ?? payload.to;
      const pFrom = eventData.from ?? payload.from;
      const pChatId = eventData.chatId ?? payload.chatId;
      const pRecipient = eventData.recipient ?? payload.recipient;
      const pRemoteJid = eventData.remoteJid ?? payload.remoteJid;
      const pPhone = eventData.phone ?? payload.phone;
      const pConversationId = eventData.conversationId ?? payload.conversationId;

      // Lógica de roles
      if (payload.event === "ai_response" || payload.event === "message_create") {
        if (pTo) phoneCandidates.push({ phone: pTo, senderRole: "team" });
        if (pRecipient) phoneCandidates.push({ phone: pRecipient, senderRole: "team" });
        if (pChatId) phoneCandidates.push({ phone: pChatId, senderRole: "team" });
        if (pRemoteJid) phoneCandidates.push({ phone: pRemoteJid, senderRole: "team" });
        if (pPhone) phoneCandidates.push({ phone: pPhone, senderRole: "team" });
        if (pConversationId) phoneCandidates.push({ phone: pConversationId, senderRole: "team" });
      }

      if (payload.event !== "ai_response") {
        if (pFrom) phoneCandidates.push({ phone: pFrom, senderRole: "lead" });
      }

      console.log("Phone Candidates:", phoneCandidates);

      // ============================================================
      // OBTENER CONFIGURACIÓN DE EMPRESAS
      // ============================================================
      let empresasConfig: Array<{ empresa_id: string; pipeline_id?: string; etapa_id?: string }> = [];

      // 🔍 DEBUG: Log de valores de resolución de empresa
      console.log('🔍 [DEBUG] Valores para resolución de empresa:');
      console.log('   - empresaFromSecret:', empresaFromSecret);
      console.log('   - instanceResolved:', instanceResolved);
      console.log('   - cleanSecretParam:', cleanSecretParam);

      // Prioridad 1: Parámetros en la URL
      const urlEmpresaId = url.searchParams.get("empresa_id");
      const urlPipelineId = url.searchParams.get("pipeline_id");
      const urlEtapaId = url.searchParams.get("etapa_id");

      if (urlEmpresaId) {
        console.log(`✅ [EMPRESA] Usando parámetros de URL - Empresa: ${urlEmpresaId}`);
        empresasConfig = [{
          empresa_id: urlEmpresaId,
          pipeline_id: urlPipelineId || undefined,
          etapa_id: urlEtapaId || undefined
        }];
      } else if (empresaFromSecret) {
        empresasConfig = [{
          empresa_id: empresaFromSecret,
          pipeline_id: instanceConfig?.default_pipeline_id || undefined,
          etapa_id: instanceConfig?.default_stage_id || undefined
        }];
        console.log(`✅ [EMPRESA] Usando empresa resuelta por secreto: ${empresaFromSecret}`);
      }
      // Prioridad 2: WEBHOOK_EMPRESAS JSON
      else {
        try {
          const configJson = Deno.env.get("WEBHOOK_EMPRESAS");
          if (configJson) {
            empresasConfig = JSON.parse(configJson);
            console.log(`✅ [EMPRESA] Configuradas ${empresasConfig.length} empresas desde WEBHOOK_EMPRESAS`);
          } else {
            // Prioridad 3: Variables individuales
            const empresaId = Deno.env.get("DEFAULT_EMPRESA_ID");
            if (empresaId) {
              empresasConfig = [{
                empresa_id: empresaId,
                pipeline_id: Deno.env.get("DEFAULT_PIPELINE_ID") || undefined,
                etapa_id: Deno.env.get("DEFAULT_ETAPA_ID") || undefined
              }];
              console.log(`⚠️ [EMPRESA] Usando DEFAULT_EMPRESA_ID: ${empresaId}`);
            }
          }
        } catch (e) {
          console.error("Error parseando WEBHOOK_EMPRESAS:", e);
        }
      }

      // Prioridad 4: Fallback - buscar primera empresa
      if (empresasConfig.length === 0) {
        console.warn("⚠️⚠️⚠️ [EMPRESA] FALLBACK ACTIVADO - No se encontró configuración, buscando primera empresa...");
        const { data: company } = await supabase
          .from('empresa')
          .select('id')
          .limit(1)
          .maybeSingle();

        if (company) {
          empresasConfig = [{ empresa_id: company.id }];
          console.warn(`❌ [EMPRESA] USANDO FALLBACK (PRIMERA EMPRESA): ${company.id} - ESTO PUEDE SER INCORRECTO`);
        }
      }

      // Si está en modo prueba, no realizar escrituras; devolver previsualización
      if (testMode) {
        console.log("🧪 Modo prueba activo (webhook-chat): se evita crear leads/mensajes y subir storage.");
        return new Response(
          JSON.stringify({
            success: true,
            mode: 'dry-run',
            preview: {
              content,
              phoneCandidates,
              empresasConfig
            }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      // ============================================================
      // BUSCAR LEADS EN TODAS LAS EMPRESAS (búsqueda global)
      // ============================================================
      if (content) {
        let totalLeadsMatched = 0;
        let foundAnyLead = false;

        // ============================================================
        // DETERMINAR EMPRESA POR CLIENT_ID DE LA INSTANCIA (PRIORIDAD MÁXIMA)
        // ============================================================
        // Prioridad: instanceResolved (por client_id) > empresaFromSecret > urlEmpresaId > fallback
        const targetEmpresaId = instanceResolved?.empresa_id || empresaFromSecret || urlEmpresaId || (empresasConfig.length > 0 ? empresasConfig[0].empresa_id : null);

        if (!targetEmpresaId) {
          console.warn('⚠️ [MULTI-TENANT] No se pudo determinar empresa destino. Sin instancia, secreto ni configuración.');
          return new Response(JSON.stringify({
            success: false,
            error: "No se pudo determinar empresa destino. Configure client_id en empresa_instancias o webhook_secret."
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          });
        }

        console.log(`🔒 [MULTI-TENANT] Empresa destino determinada: ${targetEmpresaId}`);
        if (instanceResolved) {
          console.log(`   ✅ Resuelto por client_id: ${clientId} -> instancia: ${instanceResolved.id}`);
        } else if (empresaFromSecret) {
          console.log(`   ✅ Resuelto por webhook_secret`);
        } else {
          console.log(`   ⚠️ Usando fallback de empresasConfig`);
        }

        // Iterar por cada candidato de teléfono
        for (const candidate of phoneCandidates) {
          const targetPhone = candidate.phone;
          const senderRole = candidate.senderRole;
          if (!targetPhone) continue;

          const cleanPhone = targetPhone
            .replace("@c.us", "")
            .replace("@s.whatsapp.net", "")
            .replace("+", "")
            .trim();
          if (!cleanPhone) continue;

          console.log(`🔍 Buscando leads con teléfono: ${cleanPhone} en empresa ${targetEmpresaId}`);

          // BUSCAR SOLO EN LA EMPRESA DETERMINADA POR LAS CREDENCIALES
          const { data: leads, error } = await supabase
            .from("lead")
            .select("id, empresa_id, nombre_completo")
            .eq("empresa_id", targetEmpresaId)
            .ilike("telefono", `%${cleanPhone}%`);

          if (!error && leads && leads.length > 0) {
            foundAnyLead = true;
            console.log(`✅ Encontrados ${leads.length} leads con teléfono ${cleanPhone} en empresa ${targetEmpresaId}`);

            for (const lead of leads) {
              // Si hay archivo multimedia, descargarlo y guardarlo en Storage
              let storedMediaUrl: string | null = null;
              if (mediaUrl) {
                const mimeType = file?.mimeType || null;
                storedMediaUrl = await downloadAndStoreMedia(supabase, mediaUrl, lead.id, fileName, mimeType);
              }

              // Crear metadata normalizada
              const normalizedMetadata = {
                type: type,
                rawPayload: payload,
                data: {
                  type: type,
                  body: eventData.body || payload.body,
                  file: file,
                  media: media,
                  mediaUrl: mediaUrl,
                  mediaId: mediaId,
                  fileName: fileName,
                  storedMediaUrl: storedMediaUrl
                }
              };

              const channelType = platform === 'instagram' ? 'instagram' : (platform === 'facebook' ? 'facebook' : 'whatsapp');

              // Insertar mensaje para este lead
              const { error: insertError } = await supabase.from("mensajes").insert({
                lead_id: lead.id,
                content: content,
                sender: senderRole,
                channel: channelType,
                external_id: externalId,
                metadata: {
                  ...normalizedMetadata,
                  instanceId: instanceResolved?.id || null,
                  platform: channelType
                }
              });

              if (insertError) {
                console.error(`❌ Error insertando mensaje para lead ${lead.id}:`, insertError);
              } else {
                leadsProcessedInPhase1.add(lead.id);
                console.log(`✅ Mensaje guardado para lead ${lead.id} (${lead.nombre_completo}) [Empresa ${lead.empresa_id}] (Fase 1)`);
                if (storedMediaUrl) {
                  console.log(`✅ Archivo multimedia guardado en Storage: ${storedMediaUrl}`);
                }
                if (payload.event === "ai_response") {
                  const shouldMark = await shouldMarkAsReadForLead(supabase, lead.empresa_id, lead.id);
                  if (shouldMark) {
                    await markLeadMessagesAsRead(supabase, lead.id);
                  } else {
                    console.log(`[read-status] Saltando auto-leído por palabras clave para lead ${lead.id}`);
                  }
                }
                totalLeadsMatched++;
              }

              // Actualizar preferencia de instancia para el lead (siempre guardar la última usada)
              if (instanceResolved) {
                try {
                  await supabase
                    .from('lead')
                    .update({ preferred_instance_id: instanceResolved.id })
                    .eq('id', lead.id);
                } catch (prefErr) {
                  console.warn('[webhook] No se pudo actualizar preferred_instance_id para lead', lead.id, prefErr);
                }
              }
            }
          }

          // Si encontramos al menos un lead, no seguimos buscando con otros candidatos
          if (foundAnyLead) {
            console.log(`✅ Total: ${totalLeadsMatched} mensajes guardados en todas las empresas`);
            break;
          }
        }

        // ============================================================
        // VERIFICAR Y CREAR LEADS SOLO EN LA EMPRESA DESTINO
        // (Basado en client_id de instancia, webhook_secret, o fallback)
        // ============================================================
        console.log(`🔍 Verificando/creando leads solo en empresa destino: ${targetEmpresaId}`);

        // Buscar candidato para crear lead
        let inboundCandidate = phoneCandidates.find(c => c.senderRole === 'lead' && c.phone);
        if (!inboundCandidate) {
          inboundCandidate = phoneCandidates.find(c => c.phone);
        }

        if (inboundCandidate && inboundCandidate.phone) {
          const targetPhone = inboundCandidate.phone;
          const cleanPhone = targetPhone.replace("@c.us", "").replace("@s.whatsapp.net", "").replace("+", "").trim();

          // Resolver config de instancia correcta para crear el lead
          // Si targetEmpresaId viene de instanceResolved (client_id) Y es una instancia diferente al webhook_secret,
          // re-fetchar su configuración para obtener el pipeline/etapa real configurado.
          let resolvedInstanceConfig = instanceConfig; // default: config del webhook_secret

          if (instanceResolved && instanceResolved.id && instanceResolved.id !== instanciaIdFromSecret) {
            console.log(`🔄 [INSTANCE-CONFIG] instanceResolved (${instanceResolved.id}) difiere del secret (${instanciaIdFromSecret}), re-leyendo config...`);
            try {
              const { data: instConfigData } = await supabase
                .from('empresa_instancias')
                .select('auto_create_lead, default_pipeline_id, default_stage_id, default_lead_name, include_first_message')
                .eq('id', instanceResolved.id)
                .maybeSingle();

              if (instConfigData) {
                resolvedInstanceConfig = {
                  auto_create_lead: instConfigData.auto_create_lead !== false,
                  default_pipeline_id: instConfigData.default_pipeline_id || null,
                  default_stage_id: instConfigData.default_stage_id || null,
                  default_lead_name: instConfigData.default_lead_name || 'Nuevo lead',
                  include_first_message: instConfigData.include_first_message !== false,
                };
                console.log(`✅ [INSTANCE-CONFIG] Config re-leída para instancia ${instanceResolved.id}: pipeline=${resolvedInstanceConfig.default_pipeline_id}, stage=${resolvedInstanceConfig.default_stage_id}`);
              }
            } catch (e) {
              console.warn('[INSTANCE-CONFIG] Error re-leyendo config de instancia:', e);
            }
          }

          // Construir pipeline/etapa combinando params de URL (mayor prioridad) + config de instancia
          const targetConfigFromUrl = empresasConfig.find(c => c.empresa_id === targetEmpresaId);
          const empresa_id = targetEmpresaId;
          const pipeline_id = targetConfigFromUrl?.pipeline_id || resolvedInstanceConfig?.default_pipeline_id || null;
          const etapa_id = targetConfigFromUrl?.etapa_id || resolvedInstanceConfig?.default_stage_id || null;

          console.log(`🔍 [LEAD-CONFIG] empresa=${empresa_id}, pipeline=${pipeline_id}, etapa=${etapa_id} (fromUrl=${!!targetConfigFromUrl?.pipeline_id}, fromInstance=${!!resolvedInstanceConfig?.default_pipeline_id})`);

          console.log(`🔍 [Empresa ${empresa_id}] Verificando si existe lead con teléfono ${cleanPhone}...`);

          // 1. DEFINIR TIPO DE FUENTE PRIMERO (Evita ReferenceError)
          const sourceType = platform === 'instagram' ? 'Instagram' : (platform === 'facebook' ? 'Facebook' : 'WhatsApp');
          const sourceIcon = (platform === 'instagram') ? '📷' : '📞';

          // 2. BUSCAR SI YA EXISTE EL LEAD
          let { data: existingLead } = await supabase
            .from("lead")
            .select("id, nombre_completo")
            .eq("empresa_id", empresa_id)
            .ilike("telefono", `%${cleanPhone}%`)
            .maybeSingle();

          // 3. LÓGICA DE OBTENCIÓN DE NOMBRE
          // PRIORIDAD 1: Extraer nombre del payload (ya viene en el webhook)
          const contactName = eventData.contact?.name || eventData.fromUsername || payload.contact?.name || payload.fromUsername;

          // PRIORIDAD 2: El "client" para Super API (fallback)
          const apiClient = eventData.sender?.client || payload.sender?.client || payload.data?.sender?.client || Deno.env.get("SUPER_API_CLIENT") || "";

          let finalName = existingLead?.nombre_completo || `Nuevo Lead ${sourceType} ${cleanPhone}`;

          console.log(`🔍 [PROFILE] Debug - contactName: "${contactName}", apiClient: "${apiClient}", event: "${payload.event}", existingLead: ${!!existingLead}`);

          // Solo ejecutamos esto si:
          // 1. Es un mensaje de usuario real (no AI response)
          // 2. El lead no existe O tiene nombre genérico
          if (payload.event !== "ai_response" && (!existingLead || finalName.startsWith("Nuevo Lead"))) {

            // PRIORIDAD 1: Usar nombre del payload
            if (contactName && contactName.trim() && !contactName.includes('@')) {
              finalName = contactName.trim();
              console.log(`✅ [PROFILE] Nombre obtenido del payload: ${finalName}`);
            }
            // PRIORIDAD 2: Llamar a Super API como fallback
            else if (apiClient) {
              console.log(`👤 [PROFILE] No hay nombre en payload, intentando con Super API usando client ${apiClient}...`);
              const profileData = await fetchChatDetails(apiClient, cleanPhone, apiTokenResolved);

              if (profileData && profileData.name) {
                finalName = profileData.name;
                console.log(`✅ [PROFILE] Nombre obtenido de Super API: ${finalName}`);
              } else {
                console.log(`⚠️ [PROFILE] No se pudo obtener nombre. Se usará: ${finalName}`);
              }
            } else {
              console.log(`⚠️ [PROFILE] Sin nombre en payload ni apiClient configurado. Se usará: ${finalName}`);
            }

            // Si el lead ya existía con nombre genérico, actualizarlo
            if (existingLead && existingLead.nombre_completo.startsWith("Nuevo Lead") && !finalName.startsWith("Nuevo Lead")) {
              const { error: updateError } = await supabase
                .from('lead')
                .update({ nombre_completo: finalName })
                .eq('id', existingLead.id);

              if (updateError) {
                console.error(`❌ [PROFILE] Error actualizando nombre:`, updateError);
              } else {
                console.log(`🔄 [PROFILE] Lead ${existingLead.id} actualizado con nombre: ${finalName}`);
              }
            }
          }

          // 4. SI EL LEAD NO EXISTE, PROCEDEMOS A CREARLO
          let newLeadInstance = existingLead || null;
          let createError = null;
          let lastMinuteCheck = false;

          if (!existingLead) {
            // VERIFICAR SI SE DEBE CREAR AUTOMÁTICAMENTE (lee de la instancia)
            const autoCreate = resolvedInstanceConfig ? resolvedInstanceConfig.auto_create_lead : true;

            console.log(`🔍 [DEBUG] instanceConfig.auto_create_lead:`, instanceConfig?.auto_create_lead);
            console.log(`🔍 [DEBUG] Calculated autoCreate boolean:`, autoCreate);

            if (!autoCreate) {
              console.log(`[Empresa ${empresa_id}] Auto-creación desactivada para esta instancia. Saltando.`);
              return new Response(JSON.stringify({ success: true, message: "Auto-create disabled" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
              });
            }

            // ==========================================================
            // 5. CREACIÓN DE NUEVO LEAD (Si llegamos aquí, es nuevo)
            // ==========================================================

            // Determinar Pipeline (prioridad: URL param > instancia > fallback)
            let targetPipelineId = pipeline_id || resolvedInstanceConfig?.default_pipeline_id || null;
            if (!targetPipelineId) {
              const { data: pipeline } = await supabase.from('pipeline').select('id').eq('empresa_id', empresa_id).order('created_at', { ascending: true }).limit(1).maybeSingle();
              if (pipeline) targetPipelineId = pipeline.id;
            }

            // Determinar Etapa (prioridad: URL param > instancia > fallback)
            let targetEtapaId = etapa_id || resolvedInstanceConfig?.default_stage_id || null;
            if (targetPipelineId && !targetEtapaId) {
              const { data: etapa } = await supabase.from('etapas').select('id, nombre').eq('pipeline_id', targetPipelineId).or('nombre.ilike.%inicial%,nombre.ilike.%nuevo%,nombre.ilike.%new%').order('orden', { ascending: true, nullsFirst: false }).limit(1).maybeSingle();
              if (etapa) targetEtapaId = etapa.id;
              else {
                const { data: firstEtapa } = await supabase.from('etapas').select('id').eq('pipeline_id', targetPipelineId).order('orden', { ascending: true, nullsFirst: false }).limit(1).maybeSingle();
                if (firstEtapa) targetEtapaId = firstEtapa.id;
              }
            }

            // Nombre por defecto si no se obtuvo uno real (lee de la instancia correcta)
            const defaultName = resolvedInstanceConfig?.default_lead_name || "Nuevo Lead";
            if (finalName.startsWith("Nuevo Lead") && defaultName !== "Nuevo Lead") {
              finalName = `${defaultName} ${sourceType} ${cleanPhone}`;
            }

            // Objeto del nuevo Lead usando 'finalName'
            const newLeadPayload = {
              nombre_completo: finalName,
              telefono: cleanPhone,
              empresa_id: empresa_id,
              pipeline_id: targetPipelineId,
              etapa_id: targetEtapaId,
              prioridad: 'medium',
              empresa: `${sourceType} Contact`,
              correo_electronico: `${cleanPhone}@${sourceType.toLowerCase()}.com`,
              asignado_a: '00000000-0000-0000-0000-000000000000'
            };

            // Insertar Lead (con manejo de race condition)
            let { data: createdLead, error: insertError } = await supabase
              .from("lead")
              .insert(newLeadPayload)
              .select("id")
              .single();

            if (insertError && insertError.code === '23505') {
              const { data: raceLead } = await supabase.from("lead").select("id").eq("empresa_id", empresa_id).eq("telefono", cleanPhone).maybeSingle();
              if (raceLead) {
                newLeadInstance = raceLead;
                lastMinuteCheck = true;
                insertError = null;
              }
            } else {
              newLeadInstance = createdLead;
            }
            createError = insertError;
          }

          // Guardar mensaje si tenemos un lead (nuevo o existente)
          if (newLeadInstance) {
            // --- Lógica de Multimedia y Mensajes ---
            let storedMediaUrl: string | null = null;
            if (mediaUrl) {
              const mimeType = file?.mimeType || null;
              storedMediaUrl = await downloadAndStoreMedia(supabase, mediaUrl, newLeadInstance.id, fileName, mimeType);
            }

            const normalizedMetadata = {
              type: type,
              rawPayload: payload,
              data: {
                type: type,
                body: eventData.body || payload.body,
                file: file,
                media: media,
                mediaUrl: mediaUrl,
                mediaId: mediaId,
                fileName: fileName,
                storedMediaUrl: storedMediaUrl
              }
            };

            // SOLO INSERTAR SI NO SE PROCESÓ EN LA FASE 1
            if (!leadsProcessedInPhase1.has(newLeadInstance.id)) {
              // Verificar si se debe incluir el primer mensaje (lee de la instancia)
              const includeFirst = existingLead || (resolvedInstanceConfig ? resolvedInstanceConfig.include_first_message : true);

              if (includeFirst) {
                await supabase.from("mensajes").insert({
                  lead_id: newLeadInstance.id,
                  content: content,
                  sender: 'lead',
                  channel: sourceType.toLowerCase(),
                  external_id: externalId,
                  metadata: {
                    ...normalizedMetadata,
                    instanceId: instanceResolved?.id || null,
                    platform: sourceType.toLowerCase()
                  }
                });
                console.log(`✅ [Empresa ${empresa_id}] Mensaje guardado para lead: ${newLeadInstance.id} (Fase 2)`);
              } else {
                console.log(`[Empresa ${empresa_id}] Saltando guardado de mensaje inicial por configuración.`);
              }
            } else {
              console.log(`⏭️ [Empresa ${empresa_id}] Saltando inserción duplicada para lead ${newLeadInstance.id} (Ya procesado en Fase 1)`);
            }

            // Auto-read si es AI response
            if (payload.event === "ai_response") {
              const shouldMark = await shouldMarkAsReadForLead(supabase, empresa_id, newLeadInstance.id);
              if (shouldMark) await markLeadMessagesAsRead(supabase, newLeadInstance.id);
            }

            // Notificación al Owner (solo si es lead nuevo, no si se encontró por race condition)
            if (!existingLead && !lastMinuteCheck && !createError) {
              try {
                const { data: empresa } = await supabase.from('empresa').select('owner_id, nombre').eq('id', empresa_id).single();
                if (empresa?.owner_id) {
                  await supabase.from('notificaciones').insert({
                    user_id: empresa.owner_id,
                    tipo: `nuevo_lead_${sourceType.toLowerCase()}`,
                    titulo: `Nuevo Lead desde ${sourceType}`,
                    mensaje: `Se ha creado automáticamente un nuevo lead ${sourceIcon}: ${finalName}`,
                    datos: { lead_id: newLeadInstance.id, telefono: cleanPhone, empresa_id: empresa_id },
                    leido: false
                  });
                }
              } catch (notifError) {
                console.warn("No se pudo crear notificación:", notifError);
              }
            }

            // Fijar preferred_instance_id para el nuevo lead (o si no tenía)
            if (instanceResolved) {
              try {
                await supabase
                  .from('lead')
                  .update({ preferred_instance_id: instanceResolved.id })
                  .eq('id', newLeadInstance.id);
              } catch (e) {
                console.warn('[webhook] No se pudo fijar preferred_instance_id:', e);
              }
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response("Method not allowed", {
      headers: corsHeaders,
      status: 405,
    });

  } catch (error: any) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
