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
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        });
      }

      // 2. Ahora s� convertimos ese texto a JSON para leer los datos
      const payload = JSON.parse(bodyText);
      console.log("Webhook payload:", payload);

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      // Estructura esperada seg�n tu log:
      // {
      //   platform: "wws",
      //   event: "ai_response",
      //   data: {
      //     body: "Hola...",
      //     from: "584123098777@c.us",
      //     to: "584126031026@c.us",
      //     ...
      //   }
      // }

      const eventData = payload.data || {};
      const content = eventData.body || payload.body;

      // Intentamos resolver el lead probando con "to" y luego con "from" para no perder mensajes
      const phoneCandidates = [] as { phone?: string | null; senderRole: "lead" | "team" }[];
      // Para respuestas de IA/equipo: normalmente el destinatario (to) es el cliente
      if (payload.event === "ai_response" || payload.event === "message_create") {
        phoneCandidates.push({ phone: eventData.to, senderRole: "team" });
      }
      // Para mensajes entrantes del cliente: from es el cliente
      phoneCandidates.push({ phone: eventData.from, senderRole: "lead" });

      if (content) {
        for (const candidate of phoneCandidates) {
          const targetPhone = candidate.phone;
          const senderRole = candidate.senderRole;
          if (!targetPhone) continue;

          const cleanPhone = targetPhone.replace("@c.us", "").replace("+", "");

          const { data: leads, error } = await supabase
            .from("lead")
            .select("id")
            .ilike("telefono", `%${cleanPhone}%`)
            .limit(1);

          if (!error && leads && leads.length > 0) {
            const lead = leads[0];

            await supabase.from("mensajes").insert({
              lead_id: lead.id,
              content: content,
              sender: senderRole,
              channel: "whatsapp",
              external_id: eventData.id,
              metadata: payload // Guardamos todo el JSON por si acaso
            });

            console.log(`Mensaje guardado para lead ${lead.id} (${cleanPhone}) con sender ${senderRole}`);
            break; // ya insertamos, salimos
          } else {
            console.log(`Lead no encontrado para teléfono: ${cleanPhone}`);
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

  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});


/*

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

    console.log(bodyText)

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
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        });
      }

      // 2. Ahora s� convertimos ese texto a JSON para leer los datos
      const payload = JSON.parse(bodyText);
      console.log("Webhook payload:", payload);

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      // Estructura esperada seg�n tu log:
      // {
      //   platform: "wws",
      //   event: "ai_response",
      //   data: {
      //     body: "Hola...",
      //     from: "584123098777@c.us",
      //     to: "584126031026@c.us",
      //     ...
      //   }
      // }

      const eventData = payload.data || {};
      const content = eventData.body;
      
      // L�gica para determinar qui�n es el lead:
      // - Si es mensaje entrante (cliente escribe), el lead es "from".
      // - Si es respuesta (AI/equipo escribe), el lead es "to".
      // Por defecto asumimos mensaje entrante.
      let targetPhone = eventData.from;
      let senderRole = "lead";

      // Ajusta estos eventos seg�n lo que mande tu Super API para respuestas salientes
      if (payload.event === "ai_response" || payload.event === "message_create") {
         targetPhone = eventData.to;
         senderRole = "team"; 
      }

      if (targetPhone && content) {
        // Limpiamos el tel�fono: quitamos @c.us y el +
        const cleanPhone = targetPhone.replace("@c.us", "").replace("+", "");
        
        // Buscamos el lead en tu tabla "lead"
        const { data: leads, error } = await supabase
          .from("lead")
          .select("id")
          .ilike("telefono", `%${cleanPhone}%`)
          .limit(1);

        if (!error && leads && leads.length > 0) {
          const lead = leads[0];

          // Insertamos en la tabla "mensajes"
          await supabase.from("mensajes").insert({
            lead_id: lead.id,
            content: content,
            sender: senderRole,
            channel: "whatsapp",
            external_id: eventData.id,
            metadata: payload // Guardamos todo el JSON por si acaso
          });
          
          console.log(`Mensaje guardado para lead ${lead.id} (${cleanPhone})`);
        } else {
          console.log(`Lead no encontrado para tel�fono: ${cleanPhone}`);
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

  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});



*/

