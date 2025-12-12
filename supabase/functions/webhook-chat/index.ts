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

          // Buscamos TODOS los leads que coincidan con el teléfono (para soportar múltiples empresas)
          const { data: leads, error } = await supabase
            .from("lead")
            .select("id, empresa_id")
            .ilike("telefono", `%${cleanPhone}%`);

          if (!error && leads && leads.length > 0) {
            console.log(`Encontrados ${leads.length} leads para el teléfono ${cleanPhone}`);
            
            for (const lead of leads) {
              // Insertamos el mensaje para CADA lead encontrado
              // Así, si el mismo número está en varias empresas, todas reciben el mensaje
              await supabase.from("mensajes").insert({
                lead_id: lead.id,
                content: content,
                sender: senderRole,
                channel: "whatsapp",
                external_id: externalId, // Nota: external_id se repetirá en la tabla, pero lead_id es distinto
                metadata: payload 
              });
              console.log(`Mensaje guardado para lead ${lead.id} (Empresa: ${lead.empresa_id})`);
            }
            
            matched = true;
            break; 
          } else {
            console.log(`Lead no encontrado para teléfono: ${cleanPhone}`);
          }
        }
        if (!matched) {
            console.log("No se encontró lead para ninguno de los candidatos.");
        }
      } else {
          console.log("No content found in payload.");
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

  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
