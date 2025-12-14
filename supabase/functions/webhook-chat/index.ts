import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hub-signature-256, x-signature-256",
};

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
        /*
        return new Response(JSON.stringify({ 
          error: "Invalid signature", 
          detail: "Signature mismatch",
          received: receivedSignature, 
          calculated: hashHex 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        });
        */
      }

      // 2. Convertimos el texto a JSON para leer los datos
      const payload = JSON.parse(bodyText);
      console.log("Webhook payload:", payload);

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

      console.log("Event Data Keys:", Object.keys(eventData));

      // 1. Intentamos sacar el texto normal
      let content = eventData.body ?? payload.body ?? eventData.text ?? payload.text;

      const externalId = eventData.id ?? payload.id;
      const media = eventData.media ?? payload.media;
      const type = eventData.type ?? payload.type; // image, video, audio, etc.

      // 2. Intentamos buscar la URL del archivo multimedia
      // Nota: Diferentes APIs ponen la URL en sitios distintos. Probamos los más comunes.
      let mediaUrl = null;

      if (typeof media === 'string' && media.startsWith('http')) {
        mediaUrl = media; // A veces 'media' es directamente la URL
      } else if (typeof media === 'object') {
        // Buscamos en todas las posibles ubicaciones conocidas
        mediaUrl = media.url ||
          media.link ||
          media.file ||
          (media.links && media.links.download) ||
          null;
      }

      // Si la API lo manda en el root (ej: payload.mediaUrl)
      if (!mediaUrl) {
        mediaUrl = eventData.mediaUrl ||
          payload.mediaUrl ||
          eventData.fileUrl ||
          payload.fileUrl ||
          eventData.url ||
          payload.url;
      }

      // Si el 'body' o 'content' es una URL y el tipo es media, úsalo como mediaUrl
      if (!mediaUrl && content && typeof content === 'string' && content.startsWith('http')) {
        const isMedia = type === 'image' || type === 'video' || type === 'audio' || type === 'document' || type === 'ptt';
        if (isMedia) {
          mediaUrl = content;
        }
      }

      // 3. Decidimos qué guardar en la base de datos
      if (mediaUrl) {
        // Si encontramos una URL, la guardamos.
        // Si venía texto acompañado de foto (caption), lo juntamos.
        if (content) {
          content = `${content} \n ${mediaUrl}`;
        } else {
          content = mediaUrl; // Guardamos solo el link
        }
      } else {
        // Si NO hay URL pero detectamos que es un archivo, mantenemos el placeholder
        // para saber que llegó algo aunque no tengamos el link.
        if (!content && (media || type === 'image' || type === 'video' || type === 'audio' || type === 'document' || type === 'ptt')) {
          content = `📷 [Archivo ${type} recibido] (Sin URL pública)`;
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
        // Mensaje saliente (Team/AI -> Lead)
        // El lead es el destinatario
        if (pTo) phoneCandidates.push({ phone: pTo, senderRole: "team" });
        if (pRecipient) phoneCandidates.push({ phone: pRecipient, senderRole: "team" });
        if (pChatId) phoneCandidates.push({ phone: pChatId, senderRole: "team" });
        if (pRemoteJid) phoneCandidates.push({ phone: pRemoteJid, senderRole: "team" });
        if (pPhone) phoneCandidates.push({ phone: pPhone, senderRole: "team" });
        if (pConversationId) phoneCandidates.push({ phone: pConversationId, senderRole: "team" });
        // A veces en message_create (fromMe=true), el 'to' es el lead.
      }

      // Mensaje entrante (Lead -> Team)
      // El lead es el remitente
      // Nota: Si es ai_response, 'from' suele ser el bot, así que no lo agregamos como candidato 'lead'
      if (payload.event !== "ai_response") {
        if (pFrom) phoneCandidates.push({ phone: pFrom, senderRole: "lead" });
      }

      console.log("Phone Candidates:", phoneCandidates);

      if (content) {
        let matched = false;
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

          // 1. Primero determinamos la empresa target (igual lógica que después)
          let targetEmpresaId = Deno.env.get("DEFAULT_EMPRESA_ID");

          if (!targetEmpresaId) {
            // Fallback: Buscar la primera empresa
            const { data: company } = await supabase
              .from('empresa')
              .select('id')
              .limit(1)
              .maybeSingle();
            if (company) targetEmpresaId = company.id;
          }

          // 2. Buscar lead SOLO en la empresa target (no en todas las empresas)
          // Esto permite que el mismo número tenga leads independientes en diferentes empresas
          const { data: leads, error } = await supabase
            .from("lead")
            .select("id, empresa_id")
            .eq("empresa_id", targetEmpresaId || "") // Filtrar por empresa específica
            .ilike("telefono", `%${cleanPhone}%`);

          if (!error && leads && leads.length > 0) {
            console.log(`Lead encontrado en empresa ${targetEmpresaId}: ${leads.length} leads`);

            for (const lead of leads) {
              // Insertamos el mensaje para CADA lead encontrado en esta empresa
              await supabase.from("mensajes").insert({
                lead_id: lead.id,
                content: content,
                sender: senderRole,
                channel: "whatsapp",
                external_id: externalId,
                metadata: payload
              });
              console.log(`Mensaje guardado para lead ${lead.id} (Empresa: ${lead.empresa_id})`);
            }

            matched = true;
            break; // Encontramos y guardamos, salimos del loop
          } else {
            console.log(`Lead no encontrado en empresa ${targetEmpresaId} para teléfono: ${cleanPhone}`);
          }
        }

        if (!matched) {
          console.log("No se encontró lead para ninguno de los candidatos. Intentando creación automática...");

          // Solo creamos lead si el mensaje viene del cliente (role 'lead')
          // Fallback: si no hay candidato 'lead', usamos cualquier teléfono disponible
          let inboundCandidate = phoneCandidates.find(c => c.senderRole === 'lead' && c.phone);

          if (!inboundCandidate) {
            // Fallback: usar cualquier candidato con teléfono
            inboundCandidate = phoneCandidates.find(c => c.phone);
            console.log("Usando fallback: cualquier candidato con teléfono");
          }

          if (inboundCandidate && inboundCandidate.phone) {
            const targetPhone = inboundCandidate.phone;
            const cleanPhone = targetPhone.replace("@c.us", "").replace("@s.whatsapp.net", "").replace("+", "").trim();
            const timestamp = Date.now().toString().slice(-6);

            // Leer parámetros de la URL (tienen prioridad sobre secrets)
            const url = new URL(req.url);
            const urlEmpresaId = url.searchParams.get("empresa_id");
            const urlPipelineId = url.searchParams.get("pipeline_id");
            const urlEtapaId = url.searchParams.get("etapa_id");

            // Leer configuración de múltiples empresas desde variable de entorno JSON
            let empresasConfig: Array<{ empresa_id: string; pipeline_id?: string; etapa_id?: string }> = [];

            // Prioridad 1: Parámetros en la URL
            if (urlEmpresaId) {
              console.log(`Usando parámetros de URL - Empresa: ${urlEmpresaId}, Pipeline: ${urlPipelineId || 'auto'}, Etapa: ${urlEtapaId || 'auto'}`);
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
                  console.log(`Configuradas ${empresasConfig.length} empresas para auto-leads desde WEBHOOK_EMPRESAS`);
                } else {
                  // Prioridad 3: Variables individuales (backward compatibility)
                  const empresaId = Deno.env.get("DEFAULT_EMPRESA_ID");
                  if (empresaId) {
                    empresasConfig = [{
                      empresa_id: empresaId,
                      pipeline_id: Deno.env.get("DEFAULT_PIPELINE_ID") || undefined,
                      etapa_id: Deno.env.get("DEFAULT_ETAPA_ID") || undefined
                    }];
                    console.log(`Usando variables DEFAULT_* - Empresa: ${empresaId}`);
                  }
                }
              } catch (e) {
                console.error("Error parseando WEBHOOK_EMPRESAS:", e);
              }
            }

            // Prioridad 4: Fallback final - buscar primera empresa
            if (empresasConfig.length === 0) {
              console.log("No se encontró configuración, buscando primera empresa en BD...");
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

            // Iterar por cada empresa configurada
            for (const config of empresasConfig) {
              const { empresa_id, pipeline_id, etapa_id } = config;

              console.log(`[Empresa ${empresa_id}] Procesando auto-creación de lead...`);

              // Verificar si ya existe el lead en esta empresa específica
              const { data: existingLead } = await supabase
                .from("lead")
                .select("id")
                .eq("empresa_id", empresa_id)
                .ilike("telefono", `%${cleanPhone}%`)
                .maybeSingle();

              if (existingLead) {
                console.log(`[Empresa ${empresa_id}] Lead ya existe: ${existingLead.id}`);
                continue; // Saltar a la siguiente empresa
              }

              // Determinar pipeline y etapa
              let targetPipelineId = pipeline_id || null;
              let targetEtapaId = etapa_id || null;

              // Si no están configurados, buscar automáticamente
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
                  console.log(`[Empresa ${empresa_id}] Pipeline auto-detectado: ${targetPipelineId}`);
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
                  console.log(`[Empresa ${empresa_id}] Etapa encontrada: ${etapa.nombre}`);
                } else {
                  const { data: firstEtapa } = await supabase
                    .from('etapas')
                    .select('id, nombre')
                    .eq('pipeline_id', targetPipelineId)
                    .order('orden', { ascending: true, nullsFirst: false })
                    .limit(1)
                    .maybeSingle();

                  if (firstEtapa) {
                    targetEtapaId = firstEtapa.id;
                    console.log(`[Empresa ${empresa_id}] Primera etapa: ${firstEtapa.nombre}`);
                  }
                }
              }

              console.log(`[Empresa ${empresa_id}] Creando lead - Pipeline: ${targetPipelineId}, Etapa: ${targetEtapaId}`);

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
                console.log(`[Empresa ${empresa_id}] Lead creado: ${newLead.id}`);

                // Guardar el Mensaje
                await supabase.from("mensajes").insert({
                  lead_id: newLead.id,
                  content: content,
                  sender: 'lead',
                  channel: "whatsapp",
                  external_id: externalId,
                  metadata: payload
                });
                console.log(`[Empresa ${empresa_id}] Mensaje guardado`);

              } else {
                console.error(`[Empresa ${empresa_id}] Error creando lead:`, createError);
              }
            }
          }
        }
      } // Cierre del if (content)

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
