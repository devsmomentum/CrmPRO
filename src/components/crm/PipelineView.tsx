import { useEffect, useState } from 'react'
// import { useKV } from '@github/spark/hooks'
import { usePersistentState } from '@/hooks/usePersistentState'
import { Lead, Pipeline, Stage, PipelineType, TeamMember } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, DotsThree, Funnel, Trash } from '@phosphor-icons/react'
import { LeadDetailSheet } from './LeadDetailSheet'
import { AddStageDialog } from './AddStageDialog'
import { AddLeadDialog } from './AddLeadDialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'
import { deletePipeline } from '@/supabase/helpers/pipeline'

import { Building } from '@phosphor-icons/react'
import { Company } from './CompanyManagement'

export function PipelineView({ companyId, companies = [] }: { companyId?: string; companies?: Company[] }) {
  const t = useTranslation('es')
  
  if (!companyId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="bg-muted/50 p-6 rounded-full mb-4">
          <Building size={64} className="text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold mb-2">No hay empresa seleccionada</h2>
        <p className="text-muted-foreground max-w-md mb-6">
          Debes crear o seleccionar una empresa para gestionar pipelines y leads.
        </p>
      </div>
    )
  }

  const [leads, setLeads] = usePersistentState<Lead[]>(`leads-${companyId}`, [])
  const [pipelines, setPipelines] = usePersistentState<Pipeline[]>(`pipelines-${companyId}`, [])
  const [teamMembers] = usePersistentState<TeamMember[]>(`team-members-${companyId}`, [])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [activePipeline, setActivePipeline] = useState<PipelineType>('sales')
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null)
  const [filterByMember, setFilterByMember] = useState<string>('all')

  const currentPipeline = (pipelines || []).find(p => p.type === activePipeline)
  const allPipelineLeads = (leads || []).filter(l => l.pipeline === activePipeline)
  const eligibleMembers = (teamMembers || []).filter(m => !m.pipelines || (m.pipelines || []).includes(activePipeline))
  const teamMemberNames = eligibleMembers.map(m => m.name)
  const pipelineLeads = filterByMember === 'all' 
    ? allPipelineLeads 
    : allPipelineLeads.filter(l => l.assignedTo === filterByMember)

  useEffect(() => {
    if (filterByMember !== 'all' && !teamMemberNames.includes(filterByMember)) {
      setFilterByMember('all')
    }
  }, [activePipeline, teamMembers])

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
      
      if (pipelineIndex === -1) {
        const newPipeline: Pipeline = {
          id: `${activePipeline}-pipeline`,
          name: activePipeline === 'sales' ? 'Sales Pipeline' : 
                activePipeline === 'support' ? 'Support Pipeline' : 'Administrative Pipeline',
          type: activePipeline,
          stages: [stage]
        }
        return [...pipelines, newPipeline]
      }
      
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

  const handleDeleteLead = (leadId: string) => {
    setLeads((current) => (current || []).filter(l => l.id !== leadId))
    setSelectedLead((current) => current?.id === leadId ? null : current)
    toast.success(t.messages.leadDeleted)
  }
  
  const handleDeleteStage = (stageId: string) => {
    setPipelines((current) => {
      const pipelines = current || []
      const pipelineIndex = pipelines.findIndex(p => p.type === activePipeline)
      
      if (pipelineIndex === -1) return pipelines
      
      const updatedPipelines = [...pipelines]
      updatedPipelines[pipelineIndex] = {
        ...updatedPipelines[pipelineIndex],
        stages: updatedPipelines[pipelineIndex].stages.filter(s => s.id !== stageId)
      }
      
      return updatedPipelines
    })
    toast.success('Etapa eliminada')
  }

  const handleDeletePipeline = async () => {
    if (['sales', 'support', 'administrative'].includes(activePipeline)) return

    try {
      // Si el pipeline tiene un ID (es decir, está guardado en BD), lo eliminamos
      if (currentPipeline?.id && !currentPipeline.id.startsWith('pipeline-')) {
         await deletePipeline(currentPipeline.id)
      }
      
      setPipelines((current) => (current || []).filter(p => p.type !== activePipeline))
      setActivePipeline('sales')
      toast.success('Pipeline eliminado correctamente')
    } catch (error: any) {
      console.error('Error deleting pipeline:', error)
      toast.error(`Error al eliminar pipeline: ${error.message || 'Error desconocido'}`)
    }
  }

  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    setDraggedLead(lead)
    e.dataTransfer.effectAllowed = 'move'
  }
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
  
  const handleDrop = (e: React.DragEvent, targetStageId: string) => {
    e.preventDefault()
    
    if (!draggedLead) return
    
    if (draggedLead.stage === targetStageId) {
      setDraggedLead(null)
      return
    }
    
    const updatedLead = {
      ...draggedLead,
      stage: targetStageId
    }
    
    setLeads((current) => 
      (current || []).map(l => l.id === draggedLead.id ? updatedLead : l)
    )
    
    setDraggedLead(null)
    toast.success('Lead movido a nueva etapa')
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 md:p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h1 className="text-2xl md:text-3xl font-bold">{t.pipeline.title}</h1>
          <div className="flex gap-2">
            {['sales', 'support', 'administrative'].includes(activePipeline) ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button variant="destructive" size="sm" disabled className="opacity-50">
                        <Trash className="mr-2" size={20} />
                        <span className="hidden sm:inline">Eliminar Pipeline</span>
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Los pipelines predeterminados no se pueden eliminar</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash className="mr-2" size={20} />
                    <span className="hidden sm:inline">Eliminar Pipeline</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. Se eliminará el pipeline "{currentPipeline?.name}" y toda su configuración.
                      Los leads asociados podrían dejar de ser visibles.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeletePipeline} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <AddStageDialog
              pipelineType={activePipeline}
              currentStagesCount={currentPipeline?.stages.length || 0}
              onAdd={handleAddStage}
              trigger={
                <Button variant="outline" size="sm">
                  <Plus className="mr-2" size={20} />
                  <span className="hidden sm:inline">{t.pipeline.addStage}</span>
                </Button>
              }
            />
            <AddLeadDialog
              pipelineType={activePipeline}
              stages={currentPipeline?.stages || []}
              teamMembers={teamMemberNames}
              onAdd={handleAddLead}
              companies={companies}
            />
          </div>
        </div>

        <Tabs value={activePipeline} onValueChange={(v) => setActivePipeline(v as PipelineType)}>
          <TabsList className="w-full md:w-auto flex-wrap h-auto">
            <TabsTrigger value="sales" className="text-xs md:text-sm">{t.pipeline.sales}</TabsTrigger>
            <TabsTrigger value="support" className="text-xs md:text-sm">{t.pipeline.support}</TabsTrigger>
            <TabsTrigger value="administrative" className="text-xs md:text-sm">{t.pipeline.administrative}</TabsTrigger>
            {(pipelines || [])
              .filter(p => !['sales', 'support', 'administrative'].includes(p.type))
              .map(p => (
                <TabsTrigger key={p.id} value={p.type} className="text-xs md:text-sm">
                  {p.name}
                </TabsTrigger>
              ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 mt-4">
          <Funnel size={20} className="text-muted-foreground" />
          <Select value={filterByMember} onValueChange={setFilterByMember}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por miembro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los miembros</SelectItem>
              {teamMemberNames.map(name => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filterByMember !== 'all' && (
            <Badge variant="secondary">
              Mostrando: {pipelineLeads.length} de {allPipelineLeads.length} leads
            </Badge>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-x-auto px-4 md:px-6 py-4 md:py-6">
          <div className="flex gap-3 md:gap-4 h-full min-h-0 min-w-max">
            {(currentPipeline?.stages || []).map(stage => {
              const stageLeads = pipelineLeads.filter(l => l.stage === stage.id)

              return (
                <div
                  key={stage.id}
                  className="w-72 md:w-80 flex flex-col shrink-0 min-h-0"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, stage.id)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn('w-3 h-3 rounded-full shrink-0')} style={{ backgroundColor: stage.color }} />
                      <h3 className="font-semibold text-sm md:text-base truncate">{stage.name}</h3>
                      <Badge variant="secondary" className="text-xs shrink-0">{stageLeads.length}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteStage(stage.id)}
                        title="Eliminar etapa"
                      >
                        <Trash size={16} />
                      </Button>
                      <AddLeadDialog
                        pipelineType={activePipeline}
                        stages={currentPipeline?.stages || []}
                        teamMembers={teamMemberNames}
                        onAdd={handleAddLead}
                        defaultStageId={stage.id}
                        trigger={
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground"
                            type="button"
                            title={t.pipeline.addLead}
                          >
                            <Plus size={16} />
                            <span className="sr-only">{t.pipeline.addLead}</span>
                          </Button>
                        }
                      />
                      <AddStageDialog
                        pipelineType={activePipeline}
                        currentStagesCount={currentPipeline?.stages.length || 0}
                        onAdd={handleAddStage}
                        trigger={
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground"
                            type="button"
                            title={t.pipeline.addStage}
                          >
                            <Plus size={16} />
                            <span className="sr-only">{t.pipeline.addStage}</span>
                          </Button>
                        }
                      />
                    </div>
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto min-h-[200px] bg-muted/30 rounded-lg p-2">
                    {stageLeads.map(lead => (
                      <Card
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead)}
                        className="p-2 cursor-move hover:shadow-md transition-all border-l-4 active:opacity-50"
                        style={{ borderLeftColor: stage.color }}
                        onClick={() => setSelectedLead(lead)}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm truncate">{lead.name}</h4>
                            <p className="text-xs text-muted-foreground truncate">{lead.company}</p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0">
                                <DotsThree size={14} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>{t.buttons.edit}</DropdownMenuItem>
                              <DropdownMenuItem>Mover a Etapa</DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleDeleteLead(lead.id)
                                }}
                              >
                                {t.buttons.delete}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="flex items-center gap-1 mb-1">
                          <div className={cn('w-2 h-2 rounded-full', getPriorityColor(lead.priority))} />
                          <span className="text-xs text-muted-foreground capitalize">{lead.priority}</span>
                        </div>

                        {lead.budget > 0 && (
                          <p className="text-sm font-medium text-primary mb-1">
                            ${lead.budget.toLocaleString()}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-1 mb-1">
                          {lead.tags.slice(0, 2).map(tag => (
                            <Badge
                              key={tag.id}
                              variant="outline"
                              className="text-xs h-4 px-1"
                              style={{ borderColor: tag.color, color: tag.color }}
                            >
                              {tag.name}
                            </Badge>
                          ))}
                          {lead.tags.length > 2 && (
                            <Badge variant="outline" className="text-xs h-4 px-1">
                              +{lead.tags.length - 2}
                            </Badge>
                          )}
                        </div>

                        <div className="pt-1 border-t border-border text-xs text-muted-foreground truncate">
                          {t.lead.assignedTo}: {lead.assignedTo}
                        </div>
                      </Card>
                    ))}

                    {stageLeads.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        {t.pipeline.noLeads}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {(currentPipeline?.stages || []).length === 0 && (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <p className="mb-4">{t.pipeline.noStages}</p>
                  <AddStageDialog
                    pipelineType={activePipeline}
                    currentStagesCount={0}
                    onAdd={handleAddStage}
                    trigger={
                      <Button>
                        <Plus className="mr-2" size={20} />
                        {t.pipeline.addFirstStage}
                      </Button>
                    }
                  />
                </div>
              </div>
            )}

            {(currentPipeline?.stages || []).length > 0 && (
              <div className="w-72 md:w-80 flex flex-col shrink-0 min-h-0">
                <AddStageDialog
                  pipelineType={activePipeline}
                  currentStagesCount={currentPipeline?.stages.length || 0}
                  onAdd={handleAddStage}
                  trigger={
                    <div className="flex-1 space-y-2 overflow-y-auto min-h-[200px] bg-muted/20 rounded-lg p-2 border-2 border-dashed border-border hover:border-primary transition-colors cursor-pointer flex flex-col items-center justify-center" title={t.pipeline.addStage}>
                      <Plus size={22} className="text-muted-foreground mb-1" />
                      <span className="text-xs font-medium text-muted-foreground">{t.pipeline.addStage}</span>
                    </div>
                  }
                />
              </div>
            )}
          </div>
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
