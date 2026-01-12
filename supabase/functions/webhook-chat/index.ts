// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hub-signature-256, x-signature-256",
};

const MANUAL_OVERRIDE_WINDOW_MS = 10 * 60 * 1000; // 10 minutos

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

      // Verificacion de firma solo si hay secret token configurado
      if (secretToken && receivedSignature) {
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
      } else if (!receivedSignature && secretToken) {
         return new Response(JSON.stringify({ error: "Missing signature" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 401,
         });
      }

      // 2. Parse JSON
      const payload = JSON.parse(bodyText);
      console.log("Webhook payload:", payload);

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const eventData = payload.data || {};
      const content = eventData.body || eventData.text || eventData.message || payload.body || payload.text;
      const eventName = String(payload.event || eventData.event || '').toLowerCase();
      const isAiResponse = ["ai_response","assistant_response"].includes(eventName);
      
      const eventTimestampMs = (() => {
        const rawTs = eventData.timestamp || eventData.sent_at || eventData.created_at;
        const parsed = rawTs ? Date.parse(rawTs) : NaN;
        return Number.isFinite(parsed) ? parsed : Date.now();
      })();

      // Identificar candidatos de telefono y rol
      const phoneCandidates = [] as { phone?: string | null; senderRole: "lead" | "team" }[];
      
      if (isAiResponse || eventName === "message_create" || eventName === "outbound_message") {
        phoneCandidates.push({ phone: eventData.to, senderRole: "team" });
      }
      // Mensajes entrantes
      phoneCandidates.push({ phone: eventData.from, senderRole: "lead" });

      if (content) {
        for (const candidate of phoneCandidates) {
          const targetPhone = candidate.phone;
          const senderRole = candidate.senderRole;
          if (!targetPhone) continue;

          const cleanPhone = targetPhone.replace("@c.us", "").replace(/\D/g, "");

          // Buscar lead de forma robusta por variantes del teléfono
          const findLeadByPhone = async (digits: string) => {
            const variants = new Set<string>();
            variants.add(digits);
            variants.add("+" + digits);

            // Si viene con código país VE (58...), generar local con 0
            if (digits.startsWith("58") && digits.length > 2) {
              variants.add("0" + digits.slice(2));
            }
            // Si viene sin 58 y comienza por 0, generar con 58
            if (digits.startsWith("0")) {
              variants.add("58" + digits.slice(1));
            }

            const orPartsExact: string[] = [];
            for (const v of variants) {
              // Igualdad exacta
              orPartsExact.push(`telefono.eq.${v}`);
              // Igualdad exacta con +
              if (!v.startsWith("+")) {
                orPartsExact.push(`telefono.eq.+${v}`);
              }
            }

            // Intento 1: coincidencia exacta con cualquiera de las variantes
            const { data: exactMatches, error: exactErr } = await supabase
              .from('lead')
              .select('id, telefono')
              .or(orPartsExact.join(','))
              .limit(1);

            if (!exactErr && exactMatches && exactMatches.length > 0) {
              return exactMatches[0];
            }

            // Intento 2: coincidencia por subcadena (por si hay formato con espacios/guiones)
            const orPartsLike: string[] = [];
            for (const v of variants) {
              const pattern = `%${v}%`;
              orPartsLike.push(`telefono.ilike.${pattern}`);
            }
            const { data: likeMatches, error: likeErr } = await supabase
              .from('lead')
              .select('id, telefono')
              .or(orPartsLike.join(','))
              .limit(1);

            if (!likeErr && likeMatches && likeMatches.length > 0) {
              return likeMatches[0];
            }

            return null;
          };

          let resolvedLead = await findLeadByPhone(cleanPhone);
          {
            // CREACIÓN AUTOMÁTICA DE LEAD SI NO EXISTE
            if (!resolvedLead && senderRole === 'lead') {
               console.log(`Lead desconocido detectado (${cleanPhone}). Creando automáticamente...`);
               
               // 1. Obtener primera empresa disponible (Default)
               const { data: firstEmpresa } = await supabase.from('empresa').select('id').limit(1).single();
               
               if (firstEmpresa) {
                 // 2. Obtener Pipeline por defecto (Ventas o el primero)
                 const { data: pipelines } = await supabase.from('pipeline').select('id').eq('empresa_id', firstEmpresa.id).limit(1);
                 const defaultPipeline = pipelines?.[0];
                 
                 // 3. Obtener etapa inicial
                 let defaultStageId = null;
                 if (defaultPipeline) {
                    const { data: stages } = await supabase.from('etapas').select('id').eq('pipeline_id', defaultPipeline.id).order('order', { ascending: true }).limit(1);
                    defaultStageId = stages?.[0]?.id;
                 }

                 // 4. Insertar Lead
                const { data: newLead, error: createError } = await supabase.from('lead').insert({
                    nombre_completo: eventData.pushName || `Nuevo Lead ${cleanPhone.slice(-4)}`,
                    telefono: cleanPhone,
                    correo_electronico: `${cleanPhone}@sin-email.com`, // Placeholder requerido
                    empresa_id: firstEmpresa.id,
                    pipeline_id: defaultPipeline?.id,
                    etapa_id: defaultStageId,
                    empresa: 'WhatsApp Contact',
                    created_at: new Date().toISOString()
                 }).select().single();

                 if (!createError && newLead) {
                  resolvedLead = newLead;
                  console.log(`Lead creado exitosamente: ${newLead.id}`);
                 } else {
                    console.error('Error creando lead automático:', createError);
                 }
               }
            }

            const finalLead = resolvedLead;
            if (finalLead) {
                // Lógica IA 
                if (isAiResponse) {
                    // 1) Si hubo una respuesta manual reciente del equipo, omitimos IA
                    const { data: lastTeamMessages, error: lastTeamError } = await supabase
                        .from("mensajes")
                        .select("id, created_at, metadata")
                        .eq("lead_id", lead.id)
                        .eq("sender", "team")
                        .order("created_at", { ascending: false })
                        .limit(1);

                    if (!lastTeamError) {
                        const lastTeam = lastTeamMessages?.[0];
                        const lastTeamTimestamp = lastTeam?.created_at ? Date.parse(lastTeam.created_at) : NaN;
                        const lastTeamIsManual = lastTeam && (!lastTeam.metadata || lastTeam.metadata?.event !== "ai_response");
                        
                        if (lastTeamIsManual && Number.isFinite(lastTeamTimestamp)) {
                             const delta = eventTimestampMs - lastTeamTimestamp;
                             if (delta < MANUAL_OVERRIDE_WINDOW_MS) {
                                console.log(`Omitiendo IA: respuesta manual hace ${Math.round(delta/1000)}s`);
                                return new Response(JSON.stringify({ success: true, skipped: "manual_override" }), {
                                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                                    status: 200,
                                });
                             }
                        }
                    }

                    // 2) Sólo aceptar IA si NO existe respuesta del equipo posterior al último mensaje del cliente
                    const { data: lastLeadMsg } = await supabase
                        .from("mensajes")
                        .select("created_at")
                        .eq("lead_id", lead.id)
                        .eq("sender", "lead")
                        .order("created_at", { ascending: false })
                        .limit(1);

                    const lastLeadTs = lastLeadMsg?.[0]?.created_at ? Date.parse(lastLeadMsg[0].created_at) : NaN;
                    if (Number.isFinite(lastLeadTs)) {
                         const { data: teamAfterLead } = await supabase
                            .from("mensajes")
                            .select("id, created_at")
                            .eq("lead_id", lead.id)
                            .eq("sender", "team")
                            .gt("created_at", new Date(lastLeadTs).toISOString())
                            .limit(1);
                        
                         if (teamAfterLead && teamAfterLead.length > 0) {
                             console.log("Omitiendo IA: ya hubo respuesta del equipo tras el último mensaje del cliente");
                             return new Response(JSON.stringify({ success: true, skipped: "team_already_replied" }), {
                                headers: { ...corsHeaders, "Content-Type": "application/json" },
                                status: 200,
                             });
                         }
                    }
                }

                // Insertar mensaje
                await supabase.from("mensajes").insert({
                  lead_id: finalLead.id,
                    content: content,
                    sender: senderRole,
                    channel: "whatsapp",
                    external_id: eventData.id,
                    metadata: payload 
                });

                // LOGICA LISTA DE TAREAS: Actualizar lead
                await supabase.from("lead").update({
                    last_message_at: new Date().toISOString(),
                    last_message_sender: senderRole,
                    last_message: content
                }).eq("id", finalLead.id);

                console.log(`Mensaje guardado y lead actualizado: ${finalLead.id}`);
                break; // Procesado, salir del loop
            } else {
                console.log(`Lead no encontrado para teléfono (exact match): ${cleanPhone}`);
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
    return new Response(JSON.stringify({ error: error.message || String(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

