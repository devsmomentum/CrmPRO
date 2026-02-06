import { useState, useEffect, Dispatch, SetStateAction } from 'react'
// import { useKV } from '@github/spark/hooks'
import { usePersistentState } from '@/hooks/usePersistentState'
import { Pipeline, Stage, AutomationRule, PipelineType } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash, SignOut, Pencil, Check, X } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AddPipelineDialog } from './AddPipelineDialog'
import { RolesManagement } from './RolesManagement'
import { TagsManagement } from './settings/TagsManagement'
import { CompanyManagement, Company } from './CompanyManagement'
import { CatalogManagement } from './CatalogManagement'
import { IDsViewer } from './IDsViewer'
import { IntegrationsManager } from './settings/IntegrationsManager'
import { InstancesManager } from './settings/InstancesManager'
import { updatePipeline, getPipelines } from '@/supabase/helpers/pipeline'
import { toast } from 'sonner'

interface SettingsViewProps {
  currentUserId?: string
  currentCompanyId?: string
  onCompanyChange?: (companyId: string) => void
  companies?: Company[]
  setCompanies?: Dispatch<SetStateAction<Company[]>>
  onLogout?: () => void
}

export function SettingsView({ currentUserId, currentCompanyId, onCompanyChange, companies, setCompanies, onLogout }: SettingsViewProps = {}) {
  const currentCompany = companies?.find(c => c.id === currentCompanyId)
  const userRole = currentCompany?.role || 'viewer'
  const isAdminOrOwner = userRole === 'admin' || userRole === 'owner'

  const [pipelines, setPipelines] = usePersistentState<Pipeline[]>(`pipelines-${currentCompanyId}`, [])
  const [automations, setAutomations] = usePersistentState<AutomationRule[]>(`automations-${currentCompanyId}`, [])
  const [showPipelineDialog, setShowPipelineDialog] = useState(false)
  const [editingPipelineId, setEditingPipelineId] = useState<string | null>(null)
  const [editPipelineName, setEditPipelineName] = useState('')

  /**
   * Cargar pipelines desde la BD cuando cambia la empresa
   * Esto soluciona el bug donde SettingsView mostraba pipelines de otra empresa
   * porque solo leía del caché localStorage sin verificar con la BD.
   */
  useEffect(() => {
    if (!currentCompanyId) return

    getPipelines(currentCompanyId)
      .then(({ data }) => {
        if (data) {
          const dbPipelines: Pipeline[] = data.map((p: any) => ({
            id: p.id,
            name: p.nombre,
            type: p.nombre.toLowerCase().trim().replace(/\s+/g, '-'),
            stages: (p.etapas || []).map((s: any) => ({
              id: s.id,
              name: s.nombre,
              order: s.orden,
              color: s.color,
              pipelineType: p.nombre.toLowerCase().trim().replace(/\s+/g, '-')
            })).sort((a: any, b: any) => a.order - b.order)
          }))
          setPipelines(dbPipelines)
        }
      })
      .catch(err => console.error('[SettingsView] Error loading pipelines:', err))
  }, [currentCompanyId])

  const toggleAutomation = (id: string) => {
    setAutomations((current) =>
      (current || []).map(a => a.id === id ? { ...a, enabled: !a.enabled } : a)
    )
  }

  const handleUpdatePipeline = async (pipelineId: string) => {
    if (!editPipelineName.trim()) {
      toast.error('El nombre del pipeline no puede estar vacío')
      return
    }
    try {
      await updatePipeline(pipelineId, { nombre: editPipelineName.trim() })
      setPipelines((current) =>
        (current || []).map(p =>
          p.id === pipelineId ? { ...p, name: editPipelineName.trim() } : p
        )
      )
      setEditingPipelineId(null)
      toast.success('Nombre del pipeline actualizado')
    } catch (e: any) {
      console.error('[SettingsView] Error actualizando pipeline', e)
      toast.error('No se pudo actualizar el pipeline')
    }
  }

  const handleAddPipeline = (pipeline: Pipeline) => {
    setPipelines((current) => [...(current || []), pipeline])
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 pb-24 md:pb-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Configuraciones</h1>
          <p className="text-muted-foreground mt-1">Configura pipelines y automatizaciones</p>
        </div>
        <Button
          variant="outline"
          className="text-destructive hover:bg-destructive/10 border-destructive/20 md:hidden"
          onClick={onLogout}
        >
          <SignOut className="mr-2" size={16} />
          Cerrar Sesión
        </Button>
      </div>

      <Tabs defaultValue="companies">
        <TabsList className="w-full justify-start overflow-x-auto h-auto p-1 no-scrollbar">
          <TabsTrigger value="companies">Empresas</TabsTrigger>
          <TabsTrigger value="catalog">Catálogo</TabsTrigger>
          <TabsTrigger value="tags">Etiquetas</TabsTrigger>
          <TabsTrigger value="pipelines">Pipelines</TabsTrigger>
          {isAdminOrOwner && <TabsTrigger value="roles">Roles</TabsTrigger>}
          {isAdminOrOwner && <TabsTrigger value="automations">Automatizaciones</TabsTrigger>}
          {isAdminOrOwner && <TabsTrigger value="integrations">Integraciones</TabsTrigger>}
          {isAdminOrOwner && <TabsTrigger value="instances">Instancias</TabsTrigger>}
          {isAdminOrOwner && <TabsTrigger value="ids">IDs</TabsTrigger>}
        </TabsList>

        <TabsContent value="companies" className="space-y-4 mt-6">
          {currentUserId && onCompanyChange && companies && setCompanies ? (
            <CompanyManagement
              currentUserId={currentUserId}
              currentCompanyId={currentCompanyId || ''}
              onCompanyChange={onCompanyChange}
              companies={companies}
              setCompanies={setCompanies}
            />
          ) : (
            <p className="text-center text-muted-foreground py-12">
              Inicia sesión para gestionar tus empresas
            </p>
          )}
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4 mt-6">
          {isAdminOrOwner ? (
            <IntegrationsManager empresaId={currentCompanyId || ''} />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No tienes permisos para gestionar integraciones.
            </div>
          )}
        </TabsContent>

        <TabsContent value="instances" className="space-y-4 mt-6">
          {isAdminOrOwner ? (
            <InstancesManager empresaId={currentCompanyId || ''} />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No tienes permisos para gestionar instancias.
            </div>
          )}
        </TabsContent>

        <TabsContent value="catalog" className="space-y-4 mt-6">
          {isAdminOrOwner ? (
            <CatalogManagement />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No tienes permisos para gestionar el catálogo.
            </div>
          )}
        </TabsContent>

        <TabsContent value="tags" className="space-y-4 mt-6">
          <TagsManagement empresaId={currentCompanyId || ''} />
        </TabsContent>

        <TabsContent value="pipelines" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Pipeline Configuration</h2>
            {isAdminOrOwner && (
              <Button onClick={() => setShowPipelineDialog(true)}>
                <Plus className="mr-2" size={20} />
                Nuevo Pipeline
              </Button>
            )}
          </div>

          {(pipelines || []).map(pipeline => (
            <Card key={pipeline.id} className="group">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    {editingPipelineId === pipeline.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editPipelineName}
                          onChange={(e) => setEditPipelineName(e.target.value)}
                          className="h-8 w-64"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdatePipeline(pipeline.id)
                            if (e.key === 'Escape') setEditingPipelineId(null)
                          }}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => handleUpdatePipeline(pipeline.id)}
                        >
                          <Check size={16} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setEditingPipelineId(null)}
                        >
                          <X size={16} />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <CardTitle>{pipeline.name}</CardTitle>
                        {isAdminOrOwner && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              setEditingPipelineId(pipeline.id)
                              setEditPipelineName(pipeline.name)
                            }}
                          >
                            <Pencil size={14} />
                          </Button>
                        )}
                      </div>
                    )}
                    <Badge variant="outline" className="mt-2">{pipeline.type}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Stages</Label>
                  <div className="flex flex-wrap gap-2">
                    {pipeline.stages.map(stage => (
                      <Badge
                        key={stage.id}
                        style={{ backgroundColor: stage.color, color: 'white' }}
                      >
                        {stage.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {(pipelines || []).length === 0 && (
            <p className="text-center text-muted-foreground py-12">No hay pipelines configurados</p>
          )}

        </TabsContent>

        <TabsContent value="roles" className="space-y-4 mt-6">
          <RolesManagement />
        </TabsContent>

        <TabsContent value="automations" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Automation Rules</h2>
            <Button>
              <Plus className="mr-2" size={20} />
              Nueva Automatización
            </Button>
          </div>

          {(automations || []).map(automation => (
            <Card key={automation.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{automation.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Trigger: {automation.trigger.replace('_', ' ')}
                    </p>
                  </div>
                  <Switch
                    checked={automation.enabled}
                    onCheckedChange={() => toggleAutomation(automation.id)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Actions</Label>
                  <div className="space-y-1">
                    {automation.actions.map((action, idx) => (
                      <div key={idx} className="text-sm">
                        • {action.type.replace('_', ' ')}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {(automations || []).length === 0 && (
            <p className="text-center text-muted-foreground py-12">No hay automatizaciones configuradas</p>
          )}
        </TabsContent>


        <TabsContent value="ids" className="space-y-4 mt-6">
          <h2 className="text-xl font-semibold">IDs del Sistema</h2>
          <p className="text-muted-foreground text-sm">
            Usa estos IDs para configurar las variables de entorno del webhook de WhatsApp.
          </p>
          <IDsViewer
            empresaId={currentCompanyId}
            empresaNombre={currentCompany?.name}
          />
        </TabsContent>
      </Tabs>

      <AddPipelineDialog
        open={showPipelineDialog}
        onClose={() => setShowPipelineDialog(false)}
        onAdd={handleAddPipeline}
        empresaId={currentCompanyId}
      />
    </div>
  )
}
