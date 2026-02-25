import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { upsertIntegration } from '@/supabase/services/integrations'
import { supabase } from '@/supabase/client'
import { InstancesManager } from './InstancesManager'
import { Plug, Phone, FloppyDisk, Trash, WarningCircle, Info } from '@phosphor-icons/react'

interface Props {
  empresaId: string
}

export function IntegrationsManager({ empresaId }: Props) {
  const [integrationId, setIntegrationId] = useState<string | null>(null)
  const [allowedPhone, setAllowedPhone] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: integration, error } = await supabase
        .from('integraciones')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('provider', 'chat')
        .maybeSingle()

      if (error) console.error('Error loading integration:', error);

      if (integration) {
        setIntegrationId(integration.id)
        const meta = integration.metadata || {}
        setAllowedPhone(meta.allowed_phone || '')
      } else {
        setIntegrationId(null)
      }
    }
    load()
  }, [empresaId])

  const handleSave = async () => {
    try {
      const integration = await upsertIntegration(empresaId, 'chat', {
        allowed_phone: allowedPhone || null,
      })
      setIntegrationId(integration.id)
      toast.success('Configuración guardada')
    } catch (e: any) {
      console.error('[IntegrationsManager] Error saving', e)
      toast.error('No se pudo guardar la configuración')
    }
  }

  const handleDelete = async () => {
    if (!integrationId) {
      toast.error('No hay configuración para eliminar')
      return
    }

    if (!confirm('¿Estás seguro de que deseas eliminar esta configuración? Esta acción no se puede deshacer.')) {
      return
    }

    try {
      const { error: integError } = await supabase
        .from('integraciones')
        .delete()
        .eq('id', integrationId)

      if (integError) throw integError

      setIntegrationId(null)
      setAllowedPhone('')

      toast.success('Configuración eliminada correctamente')
    } catch (e: any) {
      console.error('[IntegrationsManager] Error deleting', e)
      toast.error('No se pudo eliminar la configuración')
    }
  }

  return (
    <div className="space-y-8">
      {/* Configuración General */}
      <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-violet-500/5 to-transparent pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Plug size={20} weight="duotone" className="text-violet-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">Configuración General</CardTitle>
              <CardDescription className="text-xs">Ajustes globales de integración</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Phone size={14} weight="duotone" className="text-violet-500" />
              Teléfono permitido
              <Badge variant="outline" className="text-[9px] uppercase tracking-wider font-bold rounded-md ml-1">Opcional</Badge>
            </Label>
            <Input
              value={allowedPhone}
              onChange={(e) => setAllowedPhone(e.target.value)}
              placeholder="584XXXXXXXXX"
              className="rounded-xl"
            />
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Info size={12} className="text-muted-foreground shrink-0" />
              Si se especifica, solo se procesarán mensajes de este número.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} className="rounded-xl shadow-sm gap-2">
              <FloppyDisk size={16} weight="bold" />
              Guardar Configuración
            </Button>
            {integrationId && (
              <Button onClick={handleDelete} variant="destructive" className="rounded-xl gap-2">
                <Trash size={16} weight="bold" />
                Eliminar
              </Button>
            )}
          </div>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
            <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Nota:</strong> Las credenciales y la configuración de pipeline/etapa para números no registrados se configuran en cada <strong className="text-foreground">instancia</strong> más abajo.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Instancias por Plataforma */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Plug size={20} weight="duotone" className="text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Instancias por Plataforma</h2>
            <p className="text-xs text-muted-foreground">Configura tus credenciales de Super API y el pipeline/etapa destino para cada instancia.</p>
          </div>
        </div>
        <InstancesManager empresaId={empresaId} />
      </div>
    </div>
  )
}
