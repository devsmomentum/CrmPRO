import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { upsertIntegration } from '@/supabase/services/integrations'
import { supabase } from '@/supabase/client'
import { InstancesManager } from './InstancesManager'
import { getPipelines } from '@/supabase/helpers/pipeline'
import type { Pipeline } from '@/lib/types'

interface Props {
  empresaId: string
}

export function IntegrationsManager({ empresaId }: Props) {
  const [integrationId, setIntegrationId] = useState<string | null>(null)
  const [webhookSecret, setWebhookSecret] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [apiUrl, setApiUrl] = useState('')
  const [allowedPhone, setAllowedPhone] = useState('')
  const [testMode, setTestMode] = useState(false)
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [autoCreateLead, setAutoCreateLead] = useState(false)
  const [defaultPipelineId, setDefaultPipelineId] = useState('')
  const [defaultStageId, setDefaultStageId] = useState('')
  const [defaultLeadName, setDefaultLeadName] = useState('Nuevo lead')
  const [includeFirstMessage, setIncludeFirstMessage] = useState(true)

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
        setIntegrationId(integration.id)
        const meta = integration.metadata || {}
        setAllowedPhone(meta.allowed_phone || '')
        setTestMode(!!meta.test_mode)
        setAutoCreateLead(!!meta.unregistered_auto_create)
        setDefaultPipelineId(meta.unregistered_pipeline_id || '')
        setDefaultStageId(meta.unregistered_stage_id || '')
        setDefaultLeadName(meta.unregistered_default_name || 'Nuevo lead')
        setIncludeFirstMessage(meta.unregistered_include_first_message !== false)
        const { data: creds } = await supabase
          .from('integracion_credenciales')
          .select('key, value')
          .eq('integracion_id', integration.id)
        const secret = (creds || []).find(c => c.key === 'webhook_secret')?.value || ''
        const token = (creds || []).find(c => c.key === 'api_token')?.value || ''
        const url = (creds || []).find(c => c.key === 'api_url')?.value || ''
        setWebhookSecret(secret)
        setApiToken(token)
        setApiUrl(url)
      } else {
        setIntegrationId(null)
      }
    }
    load()
  }, [empresaId])

  useEffect(() => {
    if (!empresaId) return
    const loadPipelines = async () => {
      const { data, error } = await getPipelines(empresaId)
      if (error) {
        console.error('[IntegrationsManager] Error loading pipelines:', error)
        return
      }
      const mapped: Pipeline[] = (data || []).map((p: any) => ({
        id: p.id,
        name: p.nombre || 'Sin Nombre',
        type: p.nombre?.toLowerCase().trim().replace(/\s+/g, '-') || 'pipeline',
        stages: (p.etapas || []).map((s: any) => ({
          id: s.id,
          name: s.nombre,
          order: s.orden,
          color: s.color,
          pipelineType: p.nombre?.toLowerCase().trim().replace(/\s+/g, '-') || 'pipeline'
        })).sort((a: any, b: any) => a.order - b.order)
      }))
      setPipelines(mapped)
    }
    loadPipelines()
  }, [empresaId])

  useEffect(() => {
    if (pipelines.length === 0) return

    const currentPipeline = pipelines.find(p => p.id === defaultPipelineId)
    if (!currentPipeline) {
      const first = pipelines[0]
      setDefaultPipelineId(first?.id || '')
      setDefaultStageId(first?.stages?.[0]?.id || '')
      return
    }

    if (!currentPipeline.stages?.some(s => s.id === defaultStageId)) {
      setDefaultStageId(currentPipeline.stages?.[0]?.id || '')
    }
  }, [pipelines, defaultPipelineId, defaultStageId])

  const handleSave = async () => {
    if (!empresaId) {
      toast.error('Empresa no seleccionada')
      return
    }
    try {
      const integration = await upsertIntegration(empresaId, 'chat', {
        allowed_phone: allowedPhone || null,
        test_mode: testMode,
        unregistered_auto_create: autoCreateLead,
        unregistered_pipeline_id: defaultPipelineId || null,
        unregistered_stage_id: defaultStageId || null,
        unregistered_default_name: defaultLeadName || 'Nuevo lead',
        unregistered_include_first_message: includeFirstMessage
      })
      // Guardar credenciales (sin client, ahora se maneja por instancia)
      const credentials = [
        { key: 'webhook_secret', value: webhookSecret },
        { key: 'api_token', value: apiToken },
        { key: 'api_url', value: apiUrl }
      ]

      for (const cred of credentials) {
        if (cred.value) {
          const { error } = await supabase
            .from('integracion_credenciales')
            .upsert({ integracion_id: integration.id, key: cred.key, value: cred.value }, { onConflict: 'integracion_id,key' })
          if (error) throw error
        }
      }
      toast.success('Integración guardada')
    } catch (e: any) {
      console.error('[IntegrationsManager] Error saving', e)
      toast.error('No se pudo guardar la integración')
    }
  }

  const handleDelete = async () => {
    if (!integrationId) {
      toast.error('No hay integración para eliminar')
      return
    }

    if (!confirm('¿Estás seguro de que deseas eliminar esta integración? Esta acción no se puede deshacer.')) {
      return
    }

    try {
      // Primero eliminar todas las credenciales asociadas
      const { error: credsError } = await supabase
        .from('integracion_credenciales')
        .delete()
        .eq('integracion_id', integrationId)

      if (credsError) throw credsError

      // Luego eliminar la integración
      const { error: integError } = await supabase
        .from('integraciones')
        .delete()
        .eq('id', integrationId)

      if (integError) throw integError

      // Limpiar el estado
      setIntegrationId(null)
      setWebhookSecret('')
      setApiToken('')
      setApiUrl('')
      setAllowedPhone('')
      setTestMode(false)
      setAutoCreateLead(false)
      setDefaultPipelineId('')
      setDefaultStageId('')
      setDefaultLeadName('Nuevo lead')
      setIncludeFirstMessage(true)

      toast.success('Integración eliminada correctamente')
    } catch (e: any) {
      console.error('[IntegrationsManager] Error deleting', e)
      toast.error('No se pudo eliminar la integración')
    }
  }

  const handleSimulate = () => {
    if (!autoCreateLead) {
      toast('Simulacion: sin accion, no se crea lead para numeros no registrados.')
      return
    }

    const pipeline = pipelines.find(p => p.id === defaultPipelineId)
    const stage = pipeline?.stages?.find(s => s.id === defaultStageId)

    if (!pipeline || !stage) {
      toast.error('Selecciona un pipeline y una etapa para la simulacion')
      return
    }

    toast.success(`Simulacion: se crearia un lead en "${pipeline.name}" → "${stage.name}" con nombre "${defaultLeadName}"${includeFirstMessage ? ' e incluiria el primer mensaje.' : '.'}`)
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
            <Label>API URL (Opcional)</Label>
            <Input
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://v4.iasuperapi.com/api/v1 (por defecto)"
            />
            <p className="text-xs text-muted-foreground mt-1">
              URL base global. Cada instancia puede tener su propia URL personalizada.
            </p>
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
          <div className="flex gap-2">
            <Button onClick={handleSave}>Guardar Integración</Button>
            {integrationId && (
              <Button onClick={handleDelete} variant="destructive">
                Eliminar Integración
              </Button>
            )}
          </div>
          <div className="text-sm text-muted-foreground mt-2">
            URL de webhook: configura tu proveedor para llamar a
            <br />
            <code>/api/webhook-chat?secret=TU_WEBHOOK_SECRET</code>
            <br />
            Para pruebas locales sin proveedor, añade <code>&test=true</code> y envía un POST firmado.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mensajes de numeros no registrados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm">Crear lead automaticamente</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Cuando llega un mensaje de un numero que no existe en el CRM.
              </p>
            </div>
            <Switch checked={autoCreateLead} onCheckedChange={setAutoCreateLead} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Pipeline destino</Label>
              <Select value={defaultPipelineId} onValueChange={setDefaultPipelineId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map(pipeline => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Etapa destino</Label>
              <Select value={defaultStageId} onValueChange={setDefaultStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una etapa" />
                </SelectTrigger>
                <SelectContent>
                  {(pipelines.find(p => p.id === defaultPipelineId)?.stages || []).map(stage => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Nombre por defecto del lead</Label>
            <Input
              value={defaultLeadName}
              onChange={(e) => setDefaultLeadName(e.target.value)}
              placeholder="Nuevo lead"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm">Guardar mensaje inicial</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Incluye el primer mensaje como nota al crear el lead.
              </p>
            </div>
            <Switch checked={includeFirstMessage} onCheckedChange={setIncludeFirstMessage} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleSimulate}>
              Simular mensaje entrante
            </Button>
            <Button onClick={handleSave}>Guardar configuracion</Button>
          </div>
        </CardContent>
      </Card>

      {/* Gestión de Instancias Multi-Plataforma */}
      <InstancesManager empresaId={empresaId} />
    </div>
  )
}

