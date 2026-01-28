import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { upsertIntegration } from '@/supabase/services/integrations'
import { supabase } from '@/supabase/client'

interface Props {
  empresaId: string
}

export function IntegrationsManager({ empresaId }: Props) {
  const [webhookSecret, setWebhookSecret] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [allowedPhone, setAllowedPhone] = useState('')
  const [testMode, setTestMode] = useState(false)

  useEffect(() => {
    if (!empresaId) return
    // Cargar valores existentes si los hay
    const load = async () => {
      const { data: integration } = await supabase
        .from('integraciones')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('provider', 'chat')
        .maybeSingle()

      if (integration) {
        const meta = integration.metadata || {}
        setAllowedPhone(meta.allowed_phone || '')
        setTestMode(!!meta.test_mode)
        const { data: creds } = await supabase
          .from('integracion_credenciales')
          .select('key, value')
          .eq('integracion_id', integration.id)
        const secret = (creds || []).find(c => c.key === 'webhook_secret')?.value || ''
        const token = (creds || []).find(c => c.key === 'api_token')?.value || ''
        setWebhookSecret(secret)
        setApiToken(token)
      }
    }
    load()
  }, [empresaId])

  const handleSave = async () => {
    if (!empresaId) {
      toast.error('Empresa no seleccionada')
      return
    }
    try {
      const integration = await upsertIntegration(empresaId, 'chat', { allowed_phone: allowedPhone || null, test_mode: testMode })
      // Guardar credenciales
      if (webhookSecret) {
        const { error } = await supabase
          .from('integracion_credenciales')
          .upsert({ integracion_id: integration.id, key: 'webhook_secret', value: webhookSecret }, { onConflict: 'integracion_id,key' })
        if (error) throw error
      }
      if (apiToken) {
        const { error } = await supabase
          .from('integracion_credenciales')
          .upsert({ integracion_id: integration.id, key: 'api_token', value: apiToken }, { onConflict: 'integracion_id,key' })
        if (error) throw error
      }
      toast.success('Integración guardada')
    } catch (e: any) {
      console.error('[IntegrationsManager] Error saving', e)
      toast.error('No se pudo guardar la integración')
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Webhook Chat (SuperAPI)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Webhook Secret</Label>
            <Input
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              type="password"
              placeholder="secreto para validar firma (HMAC)"
            />
          </div>
          <div>
            <Label>API Token</Label>
            <Input
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              type="password"
              placeholder="token de acceso para consultas de perfil"
            />
          </div>
          <div>
            <Label>Teléfono permitido (opcional)</Label>
            <Input
              value={allowedPhone}
              onChange={(e) => setAllowedPhone(e.target.value)}
              placeholder="584XXXXXXXXX"
            />
          </div>
          <div className="flex items-center gap-2">
            <input id="test-mode" type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} />
            <Label htmlFor="test-mode">Modo prueba (dry-run, sin efectos)</Label>
          </div>
          <Button onClick={handleSave}>Guardar Integración</Button>
          <div className="text-sm text-muted-foreground mt-2">
            URL de webhook: configura tu proveedor para llamar a
            <br />
            <code>/api/webhook-chat?secret=TU_WEBHOOK_SECRET</code>
            <br />
            Para pruebas locales sin proveedor, añade <code>&test=true</code> y envía un POST firmado.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
