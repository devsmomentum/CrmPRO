import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, teamId, companyId, name, role, pipelineIds, permissionRole } = await req.json();

    const normalizedEmail = (email || '').trim().toLowerCase();

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Buscar si el usuario existe en la tabla usuarios (o auth.users)
    // Asumimos que la tabla 'usuarios' tiene el email, o buscamos en auth.users si tenemos acceso
    // Vamos a buscar en la tabla 'usuarios' pública que debería estar sincronizada
    const { data: existingUser, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id, email")
      .eq("email", normalizedEmail)
      .single();

    if (userError || !existingUser) {
      throw new Error("El usuario no está registrado en el sistema. Solo se pueden invitar usuarios existentes.");
    }

    // 1.1.a Validar duplicados: ya miembro de la empresa (por usuario_id para evitar diferencias de mayúsculas en email)
    const { data: existingMember, error: memberError } = await supabaseAdmin
      .from('empresa_miembros')
      .select('id')
      .eq('empresa_id', companyId)
      .eq('usuario_id', existingUser.id)
      .maybeSingle();

    if (memberError) {
      throw new Error(memberError.message || 'Error verificando miembros existentes');
    }
    if (existingMember) {
      throw new Error('Esa persona ya es miembro de la empresa');
    }

    // 1.1.b Validar si es el dueño (owner) de la empresa
    const { data: empresaOwner, error: ownerError } = await supabaseAdmin
      .from('empresa')
      .select('id')
      .eq('id', companyId)
      .eq('usuario_id', existingUser.id)
      .maybeSingle();

    if (ownerError) {
      throw new Error(ownerError.message || 'Error verificando dueño de la empresa');
    }
    if (empresaOwner) {
      throw new Error('Esa persona ya es miembro (owner) de la empresa');
    }

    // 1.2 Validar duplicados: invitación pendiente existente
    const { data: existingInvite, error: inviteCheckError } = await supabaseAdmin
      .from('equipo_invitaciones')
      .select('id')
      .eq('empresa_id', companyId)
      .eq('invited_email', normalizedEmail)
      .eq('status', 'pending')
      .maybeSingle();

    if (inviteCheckError) {
      throw new Error(inviteCheckError.message || 'Error verificando invitaciones existentes');
    }
    if (existingInvite) {
      throw new Error('Ya existe una invitación pendiente para este correo');
    }

    const token = crypto.randomUUID();

    // 2. Insertar en equipo_invitaciones
    const { data: insertedInvite, error: dbError } = await supabaseAdmin
      .from("equipo_invitaciones")
      .insert({
        equipo_id: teamId,
        empresa_id: companyId,
        invited_email: normalizedEmail,
        invited_usuario_id: existingUser.id, // Vinculamos directamente
        token: token,
        invited_nombre: name,
        invited_titulo_trabajo: role,
        permission_role: permissionRole || 'viewer',
        pipeline_ids: pipelineIds
      })
      .select('id, token')
      .single();

    if (dbError) throw dbError;

    // 3. Enviar correo vía Resend si está configurado, y reportar estado
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const RESEND_DOMAIN = Deno.env.get('RESEND_DOMAIN');
    const RESEND_FROM = Deno.env.get('RESEND_FROM') || (RESEND_DOMAIN ? `no-reply@${RESEND_DOMAIN}` : undefined);
    const ENABLE_EMAILS = (Deno.env.get('ENABLE_EMAILS') || 'true').toLowerCase();
    const APP_URL = Deno.env.get('APP_URL') || 'https://example.com';

    let emailResult: { sent: boolean; reason?: string } = { sent: false };

    if (ENABLE_EMAILS === 'false' || ENABLE_EMAILS === '0' || ENABLE_EMAILS === 'off') {
      console.warn('[invite-member] Emails deshabilitados por ENABLE_EMAILS');
      emailResult = { sent: false, reason: 'Emails disabled by ENABLE_EMAILS' };
    } else if (!RESEND_API_KEY) {
      console.warn('[invite-member] Falta RESEND_API_KEY, se omite envío de correo');
      emailResult = { sent: false, reason: 'Missing RESEND_API_KEY' };
    } else if (!RESEND_FROM) {
      console.warn('[invite-member] Falta RESEND_FROM o RESEND_DOMAIN para construir el remitente verificado');
      emailResult = { sent: false, reason: 'Missing RESEND_FROM/RESEND_DOMAIN' };
    } else {
      const acceptUrl = `${APP_URL}/accept-invite?token=${insertedInvite?.token || token}`;
      const html = `
        <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; max-width: 600px; margin: 0 auto;">
          <h2>Has recibido una invitación</h2>
          <p>Hola ${name || ''}, te han invitado a un equipo en nuestra plataforma.</p>
          <p>
            <a href="${acceptUrl}" style="display:inline-block;padding:10px 16px;background:#3b82f6;color:#fff;border-radius:6px;text-decoration:none">
              Aceptar invitación
            </a>
          </p>
          <p>Si no ves el botón, copia y pega este enlace en tu navegador:</p>
          <p><a href="${acceptUrl}">${acceptUrl}</a></p>
        </div>
      `;

      // Log remitente y destinatario para diagnóstico
      console.log('[invite-member] Sending email via Resend', {
        from: `Invitaciones <${RESEND_FROM}>`,
        to: normalizedEmail,
      });

      const sendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: `Invitaciones <${RESEND_FROM}>`,
          to: normalizedEmail,
          subject: 'Invitación a un equipo',
          html
        })
      });

      if (!sendRes.ok) {
        let errText = await sendRes.text();
        // Intentar parsear JSON si es válido para obtener message y name
        let parsed: any = null;
        try { parsed = JSON.parse(errText); } catch (_) {}
        const statusCode = sendRes.status;
        const baseReason = parsed?.message || parsed?.error || errText || 'Unknown Resend error';
        const validationHint = (statusCode === 403 && /testing emails|verify a domain/i.test(baseReason))
          ? 'El dominio/remitente todavía no está verificado en Resend o estás usando un FROM distinto al dominio verificado.'
          : undefined;
        console.error('[invite-member] Error enviando correo Resend', { statusCode, baseReason, from: RESEND_FROM, to: normalizedEmail });
        emailResult = { sent: false, reason: `Resend ${statusCode}: ${baseReason}${validationHint ? ' - ' + validationHint : ''}` };
      } else {
        emailResult = { sent: true };
      }
    }

    return new Response(JSON.stringify({ message: "Invitación enviada exitosamente", email: emailResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
