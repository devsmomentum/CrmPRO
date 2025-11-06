import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Pipeline, Stage, AutomationRule, PipelineType } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AddPipelineDialog } from './AddPipelineDialog'
import { RolesManagement } from './RolesManagement'
import { CompanyManagement } from './CompanyManagement'
import { CatalogManagement } from './CatalogManagement'

interface SettingsViewProps {
  currentUserId?: string
  currentCompanyId?: string
  onCompanyChange?: (companyId: string) => void
}

export function SettingsView({ currentUserId, currentCompanyId, onCompanyChange }: SettingsViewProps = {}) {
  const [pipelines, setPipelines] = useKV<Pipeline[]>('pipelines', [])
  const [automations, setAutomations] = useKV<AutomationRule[]>('automations', [])
  const [showPipelineDialog, setShowPipelineDialog] = useState(false)

  const toggleAutomation = (id: string) => {
    setAutomations((current) =>
      (current || []).map(a => a.id === id ? { ...a, enabled: !a.enabled } : a)
    )
  }
  
  const handleAddPipeline = (pipeline: Pipeline) => {
    setPipelines((current) => [...(current || []), pipeline])
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure pipelines and automations</p>
      </div>

      <Tabs defaultValue="companies">
        <TabsList>
          <TabsTrigger value="companies">Empresas</TabsTrigger>
          <TabsTrigger value="catalog">Catálogo</TabsTrigger>
          <TabsTrigger value="pipelines">Pipelines</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="automations">Automations</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="space-y-4 mt-6">
          {currentUserId && currentCompanyId && onCompanyChange ? (
            <CompanyManagement
              currentUserId={currentUserId}
              currentCompanyId={currentCompanyId}
              onCompanyChange={onCompanyChange}
            />
          ) : (
            <p className="text-center text-muted-foreground py-12">
              Inicia sesión para gestionar tus empresas
            </p>
          )}
        </TabsContent>

        <TabsContent value="catalog" className="space-y-4 mt-6">
          <CatalogManagement />
        </TabsContent>

        <TabsContent value="pipelines" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Pipeline Configuration</h2>
            <Button onClick={() => setShowPipelineDialog(true)}>
              <Plus className="mr-2" size={20} />
              New Pipeline
            </Button>
          </div>

          {(pipelines || []).map(pipeline => (
            <Card key={pipeline.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{pipeline.name}</CardTitle>
                    <Badge variant="outline" className="mt-2">{pipeline.type}</Badge>
                  </div>
                  <Button variant="outline" size="sm">
                    <Plus size={16} className="mr-2" />
                    Add Stage
                  </Button>
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
            <p className="text-center text-muted-foreground py-12">No pipelines configured</p>
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
              New Automation
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
            <p className="text-center text-muted-foreground py-12">No automations configured</p>
          )}
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4 mt-6">
          <h2 className="text-xl font-semibold">API Integrations</h2>

          <Card>
            <CardHeader>
              <CardTitle>Email Service</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>API Key</Label>
                <Input type="password" placeholder="Enter API key" />
              </div>
              <div>
                <Label>Sender Email</Label>
                <Input type="email" placeholder="noreply@company.com" />
              </div>
              <Button>Save Configuration</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SMS Service</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Account SID</Label>
                <Input placeholder="Enter account SID" />
              </div>
              <div>
                <Label>Auth Token</Label>
                <Input type="password" placeholder="Enter auth token" />
              </div>
              <Button>Save Configuration</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>WhatsApp Business</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Business Account ID</Label>
                <Input placeholder="Enter business account ID" />
              </div>
              <div>
                <Label>Access Token</Label>
                <Input type="password" placeholder="Enter access token" />
              </div>
              <Button>Save Configuration</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <AddPipelineDialog
        open={showPipelineDialog}
        onClose={() => setShowPipelineDialog(false)}
        onAdd={handleAddPipeline}
      />
    </div>
  )
}
