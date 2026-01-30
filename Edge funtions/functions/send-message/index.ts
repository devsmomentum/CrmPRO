import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-supabase-authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Interface para el objeto media según Super API
interface MediaPayload {
  downloadUrl: string
  fileName: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    console.log(supabaseClient)
    // Ahora también aceptamos 'media' para archivos multimedia
    const { lead_id, content, channel, media } = await req.json() as {
      lead_id: string
      content?: string
      channel?: string
      media?: MediaPayload
    }

    // 1. Obtener datos del Lead (necesitamos el teléfono)
    const { data: lead, error: leadError } = await supabaseClient
      .from('lead')
      .select('telefono')
      .eq('id', lead_id)
      .single()

    if (leadError || !lead || !lead.telefono) {
      throw new Error('No se encontró el lead o no tiene teléfono')
    }

    // 2. Enviar a Super API
    const SUPER_API_URL = Deno.env.get('SUPER_API_URL')
    const SUPER_API_KEY = Deno.env.get('SUPER_API_SECRET_TOKEN')

  console.log("SUPER_API_URL:",SUPER_API_URL)
  console.log("SUPER_API_KEY:",SUPER_API_KEY)


    if (SUPER_API_URL && SUPER_API_KEY) {
      // Determinar plataforma y chatId
      let platform = 'wws'; // Por defecto whatsapp
      
      if (channel === 'instagram') {
        platform = 'instagram';
      } else if (channel === 'whatsapp') {
        platform = 'wws';
      } else if (channel) {
        platform = channel;
      }

      let chatId = '';
      const rawPhone = String(lead.telefono || '');

      if (platform === 'wws') {
        // Lógica para WhatsApp
        const cleanPhone = rawPhone.replace(/\D/g, '')
        chatId = cleanPhone.includes('@c.us') ? cleanPhone : `${cleanPhone}@c.us`
      } else {
        // Lógica para Instagram (u otros)
        // Usamos el valor tal cual, asumiendo que es el ID correcto
        chatId = rawPhone.trim()
      }

      // Construir payload según Super API
      const apiPayload: Record<string, unknown> = {
        chatId: chatId,
        platform: platform
      }

      // Si hay mensaje de texto, agregarlo
      if (content) {
        apiPayload.message = content
      }

      // Si hay media, agregarlo según formato Super API
      if (media && media.downloadUrl) {
        apiPayload.media = {
          downloadUrl: media.downloadUrl,
          fileName: media.fileName || 'attachment'
        }
      }

      console.log(`[DEBUG] Lead Phone Original: '${lead.telefono}'`);
      console.log(`[DEBUG] Final ChatId: '${chatId}'`);
      console.log(`[DEBUG] Platform: '${platform}'`);
      console.log(`[DEBUG] Has Media: ${!!media}`);
      if (media) {
        console.log(`[DEBUG] Media URL: ${media.downloadUrl}`);
        console.log(`[DEBUG] Media FileName: ${media.fileName}`);
      }
      console.log(`[DEBUG] Payload:`, JSON.stringify(apiPayload));

      const response = await fetch(SUPER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPER_API_KEY}`
        },
        body: JSON.stringify(apiPayload)
      })

      const respText = await response.text()
      if (!response.ok) {
        console.error('Error enviando a Super API:', response.status, respText)
        throw new Error(`Error de Super API: ${response.status} ${respText}`)
      } else {
        console.log('Envío a Super API OK:', response.status, respText)
      }
    } else {
      console.warn('Variables de entorno SUPER_API_URL o SUPER_API_KEY no configuradas. Simulando envío.')
    }

    // 3. Guardar en nuestra base de datos (Historial)
    // Si hay media, guardamos la URL junto con el contenido
    const finalContent = media
      ? (content ? `${content}\n${media.downloadUrl}` : media.downloadUrl)
      : content

    // Metadata para archivos multimedia
    const metadata = media
      ? {
        type: 'media',
        data: {
          mediaUrl: media.downloadUrl,
          fileName: media.fileName
        }
      }
      : null

    const { data: message, error: insertError } = await supabaseClient
      .from('mensajes')
      .insert({
        lead_id: lead_id,
        content: finalContent,
        sender: 'team',
        channel: channel || 'whatsapp',
        read: true,
        metadata: metadata
      })
      .select()
      .single()

    if (insertError) throw insertError

    return new Response(JSON.stringify(message), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})