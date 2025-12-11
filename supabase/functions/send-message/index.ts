import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { lead_id, content, channel } = await req.json()

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
    // IMPORTANTE: Configura estas variables en tu Supabase Dashboard
    const SUPER_API_URL = Deno.env.get('SUPER_API_URL') // Ej: https://api.superapi.com/v1/messages
    const SUPER_API_KEY = Deno.env.get('SUPER_API_KEY') 

    if (SUPER_API_URL && SUPER_API_KEY) {
      // Normalizar teléfono al formato E.164: quitar espacios/guiones y asegurar prefijo '+'
      let phoneToSend = String(lead.telefono || '')
        .replace(/\s+/g, '')
        .replace(/-/g, '')
      if (!phoneToSend.startsWith('+')) {
        // Intento mínimo: si no tiene '+', asumimos que ya viene con código país correcto
        // Si tu API requiere estrictamente '+', lo añadimos manualmente no-op
        phoneToSend = '+' + phoneToSend
      }

      const response = await fetch(SUPER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPER_API_KEY}`
            },
            body: JSON.stringify({
          phone: phoneToSend,
                message: content,
                platform: channel || 'whatsapp'
            })
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
    const { data: message, error: insertError } = await supabaseClient
      .from('mensajes')
      .insert({
        lead_id: lead_id,
        content: content,
        sender: 'team',
        channel: channel || 'whatsapp',
        read: true
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
