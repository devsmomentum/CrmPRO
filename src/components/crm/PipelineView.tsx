import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Lead, Pipeline, Stage, PipelineType, TeamMember } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, DotsThree } from '@phosphor-icons/react'
import { LeadDetailSheet } from './LeadDetailSheet'
import { AddStageDialog } from './AddStageDialog'
import { AddLeadDialog } from './AddLeadDialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export function PipelineView() {
  const [leads, setLeads] = useKV<Lead[]>('leads', [])
  const [pipelines, setPipelines] = useKV<Pipeline[]>('pipelines', [])
  const [teamMembers] = useKV<TeamMember[]>('team-members', [])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [activePipeline, setActivePipeline] = useState<PipelineType>('sales')

  const currentPipeline = (pipelines || []).find(p => p.type === activePipeline)
  const pipelineLeads = (leads || []).filter(l => l.pipeline === activePipeline)
  const teamMemberNames = (teamMembers || []).map(m => m.name)

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive'
      case 'medium': return 'bg-warning'
      case 'low': return 'bg-muted-foreground'
      default: return 'bg-muted-foreground'
    }
  }

  const handleAddStage = (stage: Stage) => {
    setPipelines((current) => {
      const pipelines = current || []
      const pipelineIndex = pipelines.findIndex(p => p.type === activePipeline)
      
      if (pipelineIndex === -1) return pipelines
      
      const updatedPipelines = [...pipelines]
      updatedPipelines[pipelineIndex] = {
        ...updatedPipelines[pipelineIndex],
        stages: [...updatedPipelines[pipelineIndex].stages, stage]
      }
      
      return updatedPipelines
    })
  }

  const handleAddLead = (lead: Lead) => {
    setLeads((current) => [...(current || []), lead])
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">Pipeline</h1>
          <div className="flex gap-2">
            <AddStageDialog
              pipelineType={activePipeline}
              currentStagesCount={currentPipeline?.stages.length || 0}
              onAdd={handleAddStage}
              trigger={
                <Button variant="outline">
                  <Plus className="mr-2" size={20} />
                  Add Stage
                </Button>
              }
            />
            <AddLeadDialog
              pipelineType={activePipeline}
              stages={currentPipeline?.stages || []}
              teamMembers={teamMemberNames}
              onAdd={handleAddLead}
            />
          </div>
        </div>

        <Tabs value={activePipeline} onValueChange={(v) => setActivePipeline(v as PipelineType)}>
          <TabsList>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="support">Support</TabsTrigger>
            <TabsTrigger value="administrative">Administrative</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full min-w-max">
          {(currentPipeline?.stages || []).map(stage => {
            const stageLeads = pipelineLeads.filter(l => l.stage === stage.id)
            
            return (
              <div key={stage.id} className="w-80 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-3 h-3 rounded-full')} style={{ backgroundColor: stage.color }} />
                    <h3 className="font-semibold">{stage.name}</h3>
                    <Badge variant="secondary">{stageLeads.length}</Badge>
                  </div>
                  <AddStageDialog
                    pipelineType={activePipeline}
                    currentStagesCount={currentPipeline?.stages.length || 0}
                    onAdd={handleAddStage}
                  />
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto">
                  {stageLeads.map(lead => (
                    <Card 
                      key={lead.id} 
                      className="p-4 cursor-pointer hover:shadow-md transition-all border-l-4"
                      style={{ borderLeftColor: stage.color }}
                      onClick={() => setSelectedLead(lead)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-sm">{lead.name}</h4>
                          <p className="text-xs text-muted-foreground">{lead.company}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <DotsThree size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Edit</DropdownMenuItem>
                            <DropdownMenuItem>Move to Stage</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="flex items-center gap-1 mb-2">
                        <div className={cn('w-2 h-2 rounded-full', getPriorityColor(lead.priority))} />
                        <span className="text-xs text-muted-foreground capitalize">{lead.priority} priority</span>
                      </div>

                      {lead.budget > 0 && (
                        <p className="text-sm font-medium text-primary mb-2">
                          ${lead.budget.toLocaleString()}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-1">
                        {lead.tags.slice(0, 3).map(tag => (
                          <Badge 
                            key={tag.id} 
                            variant="outline" 
                            className="text-xs"
                            style={{ borderColor: tag.color, color: tag.color }}
                          >
                            {tag.name}
                          </Badge>
                        ))}
                        {lead.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{lead.tags.length - 3}
                          </Badge>
                        )}
                      </div>

                      <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
                        Assigned to: {lead.assignedTo}
                      </div>
                    </Card>
                  ))}

                  {stageLeads.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No leads in this stage
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {(currentPipeline?.stages || []).length === 0 && (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="mb-4">No stages in this pipeline yet</p>
                <AddStageDialog
                  pipelineType={activePipeline}
                  currentStagesCount={0}
                  onAdd={handleAddStage}
                  trigger={
                    <Button>
                      <Plus className="mr-2" size={20} />
                      Add First Stage
                    </Button>
                  }
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedLead && (
        <LeadDetailSheet 
          lead={selectedLead} 
          open={!!selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={(updated) => {
            setLeads((current) => 
              (current || []).map(l => l.id === updated.id ? updated : l)
            )
            setSelectedLead(updated)
          }}
        />
      )}
    </div>
  )
}
