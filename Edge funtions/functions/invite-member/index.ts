import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-supabase-authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("x-supabase-authorization") ?? req.headers.get("Authorization") ?? req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth header (x-supabase-authorization or Authorization)' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: any;
    try {
      body = await req.json();
    } catch (_) {
      return new Response(JSON.stringify({ error: 'Invalid or missing JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, teamId, companyId, name, role, pipelineIds, permissionRole } = body || {};
    if (!email || !companyId) {
      return new Response(JSON.stringify({ error: 'Missing email or companyId' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = (email || '').trim().toLowerCase();

    // Identify requester user from JWT
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: requesterData, error: requesterError } = await supabaseClient.auth.getUser();
    const requester = requesterData?.user;
    if (requesterError || !requester) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Authorize: only Owner/Admin of the company can invite
    const { data: memberData, error: memberError } = await supabaseAdmin
      .from('empresa_miembros')
      .select('role, empresa(usuario_id)')
      .eq('empresa_id', companyId)
      .eq('usuario_id', requester.id)
      .single();

    if (memberError || !memberData) {
      return new Response(JSON.stringify({ error: 'Requester is not a member of this company' }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isOwner = memberData.empresa.usuario_id === requester.id;
    const isAdmin = memberData.role === 'admin';
    if (!isOwner && !isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Only Admins or Owners can invite members' }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Buscar si el usuario existe en la tabla usuarios (o auth.users)
    // Usamos maybeSingle para no lanzar error si no existe
    const { data: existingUser, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id, email")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (userError) {
      console.error("Error checking user:", userError);
      // No lanzamos error, simplemente asumimos que no existe
    }

    // Si el usuario existe, validamos que no sea ya miembro
    if (existingUser) {
      // 1.1.a Validar duplicados: ya miembro de la empresa
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
    const { error: dbError } = await supabaseAdmin
      .from("equipo_invitaciones")
      .insert({
        equipo_id: teamId,
        empresa_id: companyId,
        invited_email: normalizedEmail,
        invited_usuario_id: existingUser ? existingUser.id : null, // Vinculamos si existe, sino null
        token: token,
        invited_nombre: name,
        invited_titulo_trabajo: role,
        permission_role: permissionRole || 'viewer',
        pipeline_ids: Array.isArray(pipelineIds) ? pipelineIds : []
      });

    if (dbError) throw dbError;

    // 3. Enviar correo vía Resend si está configurado, y reportar estado
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const RESEND_DOMAIN = Deno.env.get('RESEND_DOMAIN');
    const RESEND_FROM = Deno.env.get('RESEND_FROM') || (RESEND_DOMAIN ? `no-reply@${RESEND_DOMAIN}` : undefined);
    const ENABLE_EMAILS = (Deno.env.get('ENABLE_EMAILS') || 'true').toLowerCase();

    // Usar el origen de la petición (navegador) para construir el link correcto, 
    // útil para desarrollo local en puertos dinámicos.
    const origin = req.headers.get("origin");
    const APP_URL = Deno.env.get('APP_URL');
    const baseUrl = origin || APP_URL || 'https://example.com';

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
      const acceptUrl = `${baseUrl}/?token=${token}`;
      const html = `
        <!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitación al equipo</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .card {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .logo {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo img {
      height: 40px;
      width: auto;
    }
    h1 {
      color: #1a1a1a;
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 20px;
      text-align: center;
    }
    p {
      margin-bottom: 16px;
      font-size: 16px;
    }
    .role-badge {
      background-color: #f3f4f6;
      padding: 12px;
      border-radius: 6px;
      text-align: center;
      margin: 24px 0;
      font-weight: 500;
    }
    .button-container {
      text-align: center;
      margin-top: 32px;
      margin-bottom: 32px;
    }
    .button {
      background-color: #000000;
      color: #ffffff;
      padding: 14px 28px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      display: inline-block;
      transition: background-color 0.2s;
    }
    .footer {
      text-align: center;
      margin-top: 24px;
      font-size: 14px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <!-- Puedes reemplazar esto con tu logo real -->
        <span style="font-size: 24px; font-weight: bold;">CRM Pro</span>
      </div>
      
      <h1>¡Hola ${name}!</h1>
      
      <p>Has sido invitado a formar parte del equipo en <strong>CRM Pro</strong>.</p>
      
      <div class="role-badge">
        Rol asignado: <strong>${role}</strong>
      </div>
      
      <p>Para comenzar a colaborar con tu equipo, por favor acepta la invitación haciendo clic en el botón de abajo:</p>
      
      <div class="button-container">
        <a href="${acceptUrl}" class="button">Aceptar Invitación</a>
      </div>
      
      <p style="font-size: 14px; color: #666;">
        Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:<br>
        <a href="${acceptUrl}" style="color: #000000;">${acceptUrl}</a>
      </p>
    </div>
    
    <div class="footer">
      <p>Si no esperabas esta invitación, puedes ignorar este correo.</p>
      <p>&copy; ${new Date().getFullYear()} CRM Pro. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>
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
          from: `CRM Pro <${RESEND_FROM}>`,
          to: normalizedEmail,
          subject: 'Invitación a un equipo',
          html
        })
      });

      if (!sendRes.ok) {
        let errText = await sendRes.text();
        // Intentar parsear JSON si es válido para obtener message y name
        let parsed: any = null;
        try { parsed = JSON.parse(errText); } catch (_) { }
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
