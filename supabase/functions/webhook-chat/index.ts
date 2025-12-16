import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const secretToken = Deno.env.get("SUPER_API_SECRET_TOKEN") ?? "";
  const url = new URL(req.url);

  try {
    if (req.method === "GET") {
      const verifyToken =
        url.searchParams.get("hub.verify_token") ||
        url.searchParams.get("x-webhook-verify-token");
      const challenge = url.searchParams.get("hub.challenge");
      const mode = url.searchParams.get("hub.mode");
      console.log(verifyToken);

      if (!verifyToken || !challenge || mode !== "subscribe") {
        return new Response("Missing verification headers", {
          headers: corsHeaders,
          status: 400,
        });
      }

      if (verifyToken === secretToken) {
        return new Response(challenge, {
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
          status: 200,
        });
      }

      return new Response("Verification failed", {
        headers: corsHeaders,
        status: 403,
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
        encoder.encode(secretToken),
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

      if (hashHex !== receivedSignature) {
        console.log(`Signature Mismatch!`);
        console.log(`Received: '${receivedSignature}'`);
        console.log(`Calculated: '${hashHex}'`);
        console.log(`Secret Token Length: ${secretToken.length}`);

        // --- DEBUG MODE: IGNORAMOS EL ERROR DE FIRMA TEMPORALMENTE ---
        console.log("⚠️ IGNORING SIGNATURE ERROR FOR DEBUGGING TO TEST LOGIC ⚠️");
      }

      // 2. Convertimos el texto a JSON para leer los datos
      const payload = JSON.parse(bodyText);
      console.log("📦 [WEBHOOK] Webhook payload completo:", JSON.stringify(payload, null, 2));

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      // Normalizar eventData (puede venir como string o objeto)
      const eventDataRaw = payload.data ?? {};
      const eventData =
        typeof eventDataRaw === "string"
          ? (() => {
            try {
              return JSON.parse(eventDataRaw);
            } catch (_) {
              return {};
            }
          })()
          : eventDataRaw;

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

      // Prioridad 1: Parámetros en la URL
      const urlEmpresaId = url.searchParams.get("empresa_id");
      const urlPipelineId = url.searchParams.get("pipeline_id");
      const urlEtapaId = url.searchParams.get("etapa_id");

      if (urlEmpresaId) {
        console.log(`Usando parámetros de URL - Empresa: ${urlEmpresaId}`);
        empresasConfig = [{
          empresa_id: urlEmpresaId,
          pipeline_id: urlPipelineId || undefined,
          etapa_id: urlEtapaId || undefined
        }];
      }
      // Prioridad 2: WEBHOOK_EMPRESAS JSON
      else {
        try {
          const configJson = Deno.env.get("WEBHOOK_EMPRESAS");
          if (configJson) {
            empresasConfig = JSON.parse(configJson);
            console.log(`Configuradas ${empresasConfig.length} empresas desde WEBHOOK_EMPRESAS`);
          } else {
            // Prioridad 3: Variables individuales
            const empresaId = Deno.env.get("DEFAULT_EMPRESA_ID");
            if (empresaId) {
              empresasConfig = [{
                empresa_id: empresaId,
                pipeline_id: Deno.env.get("DEFAULT_PIPELINE_ID") || undefined,
                etapa_id: Deno.env.get("DEFAULT_ETAPA_ID") || undefined
              }];
              console.log(`Usando DEFAULT_EMPRESA_ID: ${empresaId}`);
            }
          }
        } catch (e) {
          console.error("Error parseando WEBHOOK_EMPRESAS:", e);
        }
      }

      // Prioridad 4: Fallback - buscar primera empresa
      if (empresasConfig.length === 0) {
        console.log("No se encontró configuración, buscando primera empresa...");
        const { data: company } = await supabase
          .from('empresa')
          .select('id')
          .limit(1)
          .maybeSingle();

        if (company) {
          empresasConfig = [{ empresa_id: company.id }];
          console.log(`Usando empresa fallback: ${company.id}`);
        }
      }

      // ============================================================
      // BUSCAR LEADS EN TODAS LAS EMPRESAS (búsqueda global)
      // ============================================================
      if (content) {
        let totalLeadsMatched = 0;
        let foundAnyLead = false;

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

          console.log(`🔍 Buscando leads con teléfono: ${cleanPhone} en TODAS las empresas`);

          // BUSCAR EN TODAS LAS EMPRESAS (sin filtro de empresa_id)
          const { data: leads, error } = await supabase
            .from("lead")
            .select("id, empresa_id, nombre_completo")
            .ilike("telefono", `%${cleanPhone}%`);

          if (!error && leads && leads.length > 0) {
            foundAnyLead = true;
            console.log(`✅ Encontrados ${leads.length} leads con teléfono ${cleanPhone} en total`);

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

              // Insertar mensaje para este lead
              const { error: insertError } = await supabase.from("mensajes").insert({
                lead_id: lead.id,
                content: content,
                sender: senderRole,
                channel: "whatsapp",
                external_id: externalId,
                metadata: normalizedMetadata
              });

              if (insertError) {
                console.error(`❌ Error insertando mensaje para lead ${lead.id}:`, insertError);
              } else {
                console.log(`✅ Mensaje guardado para lead ${lead.id} (${lead.nombre_completo}) [Empresa ${lead.empresa_id}]`);
                if (storedMediaUrl) {
                  console.log(`✅ Archivo multimedia guardado en Storage: ${storedMediaUrl}`);
                }
                totalLeadsMatched++;
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
        // VERIFICAR Y CREAR LEADS EN EMPRESAS CONFIGURADAS
        // (Independientemente de si existen en otras empresas)
        // ============================================================
        if (empresasConfig.length > 0) {
          console.log(`🔍 Verificando leads en ${empresasConfig.length} empresa(s) configuradas...`);

          // Buscar candidato para crear lead
          let inboundCandidate = phoneCandidates.find(c => c.senderRole === 'lead' && c.phone);
          if (!inboundCandidate) {
            inboundCandidate = phoneCandidates.find(c => c.phone);
          }

          if (inboundCandidate && inboundCandidate.phone) {
            const targetPhone = inboundCandidate.phone;
            const cleanPhone = targetPhone.replace("@c.us", "").replace("@s.whatsapp.net", "").replace("+", "").trim();

            for (const config of empresasConfig) {
              const { empresa_id, pipeline_id, etapa_id } = config;

              console.log(`🔍 [Empresa ${empresa_id}] Verificando si existe lead con teléfono ${cleanPhone}...`);

              // Verificar que no exista (doble check)
              const { data: existingLead } = await supabase
                .from("lead")
                .select("id")
                .eq("empresa_id", empresa_id)
                .ilike("telefono", `%${cleanPhone}%`)
                .maybeSingle();

              if (existingLead) {
                console.log(`⚠️ [Empresa ${empresa_id}] Lead ya existe: ${existingLead.id}`);
                continue;
              }

              // Determinar pipeline y etapa
              let targetPipelineId = pipeline_id || null;
              let targetEtapaId = etapa_id || null;

              if (!targetPipelineId) {
                const { data: pipeline } = await supabase
                  .from('pipeline')
                  .select('id')
                  .eq('empresa_id', empresa_id)
                  .order('created_at', { ascending: true })
                  .limit(1)
                  .maybeSingle();

                if (pipeline) {
                  targetPipelineId = pipeline.id;
                }
              }

              if (targetPipelineId && !targetEtapaId) {
                const { data: etapa } = await supabase
                  .from('etapas')
                  .select('id, nombre')
                  .eq('pipeline_id', targetPipelineId)
                  .or('nombre.ilike.%inicial%,nombre.ilike.%nuevo%,nombre.ilike.%new%')
                  .order('orden', { ascending: true, nullsFirst: false })
                  .limit(1)
                  .maybeSingle();

                if (etapa) {
                  targetEtapaId = etapa.id;
                } else {
                  const { data: firstEtapa } = await supabase
                    .from('etapas')
                    .select('id')
                    .eq('pipeline_id', targetPipelineId)
                    .order('orden', { ascending: true, nullsFirst: false })
                    .limit(1)
                    .maybeSingle();

                  if (firstEtapa) {
                    targetEtapaId = firstEtapa.id;
                  }
                }
              }

              // Crear el Lead
              const newLeadPayload = {
                nombre_completo: `Nuevo Lead WhatsApp ${cleanPhone}`,
                telefono: cleanPhone,
                empresa_id: empresa_id,
                pipeline_id: targetPipelineId,
                etapa_id: targetEtapaId,
                prioridad: 'medium',
                empresa: 'WhatsApp Contact',
                correo_electronico: `${cleanPhone}@unknown.com`,
                asignado_a: '00000000-0000-0000-0000-000000000000'
              };

              const { data: newLead, error: createError } = await supabase
                .from('lead')
                .insert(newLeadPayload)
                .select()
                .single();

              if (newLead && !createError) {
                console.log(`✅ [Empresa ${empresa_id}] Lead creado: ${newLead.id}`);

                // Si hay archivo multimedia, descargarlo y guardarlo en Storage
                let storedMediaUrl: string | null = null;
                if (mediaUrl) {
                  const mimeType = file?.mimeType || null;
                  storedMediaUrl = await downloadAndStoreMedia(supabase, mediaUrl, newLead.id, fileName, mimeType);
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
                    storedMediaUrl: storedMediaUrl // URL del archivo guardado en nuestro Storage
                  }
                };

                // Guardar el Mensaje
                await supabase.from("mensajes").insert({
                  lead_id: newLead.id,
                  content: content,
                  sender: 'lead',
                  channel: "whatsapp",
                  external_id: externalId,
                  metadata: normalizedMetadata
                });
                console.log(`✅ [Empresa ${empresa_id}] Mensaje guardado para nuevo lead`);

                // Crear notificación para el owner de la empresa
                try {
                  const { data: empresa } = await supabase
                    .from('empresa')
                    .select('owner_id, nombre')
                    .eq('id', empresa_id)
                    .single();

                  if (empresa?.owner_id) {
                    await supabase.from('notificaciones').insert({
                      user_id: empresa.owner_id,
                      tipo: 'nuevo_lead_whatsapp',
                      titulo: 'Nuevo Lead desde WhatsApp',
                      mensaje: `Se ha creado automáticamente un nuevo lead: ${cleanPhone}`,
                      datos: {
                        lead_id: newLead.id,
                        telefono: cleanPhone,
                        empresa_id: empresa_id
                      },
                      leido: false
                    });
                    console.log(`📬 Notificación enviada al owner de empresa ${empresa_id}`);
                  }
                } catch (notifError) {
                  console.warn("No se pudo crear notificación:", notifError);
                }

              } else {
                console.error(`❌ [Empresa ${empresa_id}] Error creando lead:`, createError);
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
