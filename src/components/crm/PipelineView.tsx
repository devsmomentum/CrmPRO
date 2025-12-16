import { useEffect, useState } from 'react'
import { useLeadsRealtime } from '@/hooks/useLeadsRealtime';
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
import { deletePipeline, getPipelines } from '@/supabase/helpers/pipeline'
import { createLead, deleteLead, getLeads, updateLead } from '@/supabase/services/leads'
import { getEquipos } from '@/supabase/services/equipos'
import { getPersonas } from '@/supabase/services/persona'
import { getPipelinesForPersona } from '@/supabase/helpers/personaPipeline'
import { createEtapa, deleteEtapa } from '@/supabase/helpers/etapas'
import { getUnreadMessagesCount, subscribeToAllMessages, markMessagesAsRead } from '@/supabase/services/mensajes'

import { Building } from '@phosphor-icons/react'
import { Company } from './CompanyManagement'
import { LeadSearchDialog } from './LeadSearchDialog'

interface User {
  id: string
  email: string
  businessName: string
}

export function PipelineView({ companyId, companies = [], user }: { companyId?: string; companies?: Company[]; user?: User | null }) {
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

  const [leads, setLeads] = useState<Lead[]>([])
  const [pipelines, setPipelines] = usePersistentState<Pipeline[]>(`pipelines-${companyId}`, [])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [activePipeline, setActivePipeline] = useState<PipelineType>('sales')
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null)
  const [filterByMember, setFilterByMember] = useState<string>('all')
  const [unreadLeads, setUnreadLeads] = useState<Set<string>>(new Set())

  const currentCompany = companies.find(c => c.id === companyId)
  const userRole = currentCompany?.role || 'viewer'
  const isAdminOrOwner = userRole === 'admin' || userRole === 'owner'
  // Viewers ahora pueden crear y editar leads, pero no eliminar ni gestionar pipelines
  const canEditLeads = true

  // Sincronización en tiempo real de leads
  useLeadsRealtime({
    companyId: companyId || '',
    onInsert: (lead) => {
      setLeads((current) => {
        // Evitar duplicados
        if (current.find(l => l.id === lead.id)) return current;
        return [...current, lead];
      });
      toast.success(`Nuevo lead agregado: ${lead.name}`);
    },
    onUpdate: (lead) => {
      setLeads((current) => current.map(l => l.id === lead.id ? lead : l));
      toast.info(`Lead actualizado: ${lead.name}`);
    },
    onDelete: (leadId) => {
      setLeads((current) => current.filter(l => l.id !== leadId));
      toast.error(`Lead eliminado`);
    }
  });

  // Cargar miembros del equipo desde BD para tener pipelines actualizados
  useEffect(() => {
    if (!companyId) return
      ; (async () => {
        try {
          const equipos = await getEquipos(companyId)
          const equiposIds = (equipos as any[]).map(e => e.id)
          const allPersonas = await Promise.all(equiposIds.map(id => getPersonas(id)))
          const personas = allPersonas.flat()

          const mapped = await Promise.all(personas.map(async p => {
            let memberPipelines: string[] = []
            try {
              const { data: pPipelines } = await getPipelinesForPersona(p.id)
              if (pPipelines) {
                // Aquí obtenemos los IDs de los pipelines asignados
                memberPipelines = pPipelines.map((pp: any) => pp.pipeline_id)
              }
            } catch (err) {
              console.error('Error loading pipelines for persona', p.id, err)
            }

            return {
              id: p.id,
              name: p.nombre,
              email: p.email,
              avatar: '',
              role: p.titulo_trabajo || '',
              teamId: p.equipo_id || undefined,
              pipelines: memberPipelines
            }
          }))
          setTeamMembers(mapped)
        } catch (e) {
          console.error('Error loading team members in PipelineView', e)
        }
      })()
  }, [companyId])

  useEffect(() => {
    if (companyId) {
      // Cargar leads
      getLeads(companyId, user?.id, isAdminOrOwner)
        .then((data: any) => {
          const mappedLeads = data.map((l: any) => ({
            id: l.id,
            name: l.nombre_completo,
            email: l.correo_electronico,
            phone: l.telefono,
            company: l.empresa,
            budget: l.presupuesto,
            stage: l.etapa_id,
            pipeline: l.pipeline_id || 'sales',
            priority: l.prioridad,
            assignedTo: l.asignado_a,
            tags: [],
            createdAt: new Date(l.created_at),
            lastContact: new Date(l.created_at)
          }))
          setLeads(mappedLeads)
        })
        .catch(err => console.error('Error loading leads:', err))

      // Cargar pipelines de BD
      getPipelines(companyId)
        .then(({ data }) => {
          if (data) {
            // Mapear DB pipelines a estructura Pipeline
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

            // Si el pipeline activo no existe en los nuevos pipelines, seleccionar el primero
            setActivePipeline(current => {
              const exists = dbPipelines.find(p => p.type === current)
              if (!exists && dbPipelines.length > 0) {
                return dbPipelines[0].type
              }
              return current
            })
          }
        })
        .catch(err => console.error('Error loading pipelines:', err))
    }
  }, [companyId])

  // Cargar mensajes no leídos
  useEffect(() => {
    if (!companyId || leads.length === 0) return

    const leadIds = leads.map(l => l.id)
    getUnreadMessagesCount(leadIds)
      .then(counts => {
        const unreadSet = new Set<string>()
        Object.entries(counts).forEach(([leadId, count]) => {
          if (count > 0) {
            unreadSet.add(leadId)
          }
        })
        setUnreadLeads(unreadSet)
      })
      .catch(err => console.error('Error loading unread messages:', err))
  }, [companyId, leads])

  // Suscribirse a mensajes nuevos en tiempo real
  useEffect(() => {
    if (!companyId) return

    const subscription = subscribeToAllMessages((msg) => {
      // Agregar lead a la lista de no leídos si el mensaje es del lead
      if (msg.lead_id && msg.sender === 'lead') {
        setUnreadLeads(prev => new Set([...prev, msg.lead_id]))
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [companyId])

  const currentPipeline = (pipelines || []).find(p => p.type === activePipeline)

  // LOGICA DE FILTRADO ROBUSTA
  const allPipelineLeads = leads.filter(l => {
    // Comparamos con el ID real (UUID) del pipeline actual
    if (l.pipeline === currentPipeline?.id) return true
    // También permitimos coincidencia por tipo si el lead tiene el string (ej: 'sales')
    if (currentPipeline?.type && l.pipeline === currentPipeline.type) return true
    return false
  })

  const eligibleMembers = (teamMembers || []).filter(m => {
    if (!m.pipelines || m.pipelines.length === 0) return false

    return m.pipelines.some(p => {
      // Coincidencia exacta (UUID o slug)
      if (p === activePipeline) return true
      // Coincidencia por nombre del pipeline custom (si se guardó nombre en vez de ID)
      if (currentPipeline && p === currentPipeline.name) return true
      // Coincidencia por ID del pipeline actual (si es custom y tiene ID)
      if (currentPipeline && currentPipeline.id && p === currentPipeline.id) return true

      return false
    })
  })

  const teamMemberNames = eligibleMembers.map(m => m.name)
  const NIL_UUID = '00000000-0000-0000-0000-000000000000'
  const pipelineLeads = filterByMember === 'all'
    ? allPipelineLeads
    : allPipelineLeads.filter(l => {
      if (filterByMember === 'me') {
        if (user && (l.assignedTo === user.id || l.assignedTo === user.businessName || l.assignedTo === user.email)) return true
        return false
      }
      if (filterByMember === 'me+todos') {
        if (user && (l.assignedTo === user.id || l.assignedTo === user.businessName || l.assignedTo === user.email)) return true
        if (l.assignedTo === NIL_UUID || l.assignedTo == null) return true
        return false
      }
      if (filterByMember === 'todos') {
        return l.assignedTo === NIL_UUID || l.assignedTo == null
      }
      if (l.assignedTo === filterByMember) return true
      const member = teamMembers.find(m => m.id === filterByMember)
      if (member && l.assignedTo === member.name) return true
      return false
    })

  useEffect(() => {
    const allowed = ['all', 'me', 'me+todos', 'todos']
    if (allowed.includes(filterByMember)) return
    if (!eligibleMembers.find(m => m.id === filterByMember)) {
      setFilterByMember('all')
    }
  }, [activePipeline, teamMembers, filterByMember, eligibleMembers])

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive'
      case 'medium': return 'bg-warning'
      case 'low': return 'bg-muted-foreground'
      default: return 'bg-muted-foreground'
    }
  }

  const handleAddStage = async (stage: Stage) => {
    if (!isAdminOrOwner) {
      toast.error('No tienes permisos para agregar etapas')
      return
    }

    const currentPipeline = pipelines.find(p => p.type === activePipeline)
    let stageToState = stage

    // Validar si es un UUID real
    const isPipelineUUID = currentPipeline?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentPipeline.id)

    // Si el pipeline existe en BD (tiene UUID), guardamos la etapa en BD
    if (currentPipeline && isPipelineUUID) {
      try {
        const { data: newStage, error } = await createEtapa({
          nombre: stage.name,
          pipeline_id: currentPipeline.id,
          orden: stage.order,
          color: stage.color
        })

        if (error) throw error

        // Usamos el ID real de la BD
        stageToState = { ...stage, id: newStage.id }
        toast.success('Etapa guardada en BD')
      } catch (err: any) {
        console.error('Error creating stage:', err)
        toast.error(`Error al guardar etapa en BD: ${err.message}`)
        return // No actualizamos estado local si falla BD
      }
    } else {
      // Si es un pipeline default (no UUID), advertimos que solo es local
      if (['sales', 'support', 'administrative'].includes(activePipeline)) {
        // Opcional: Podríamos crear el pipeline en BD aquí si quisiéramos persistencia total
        // Por ahora solo guardamos local
      }
    }

    setPipelines((current) => {
      const pipelines = current || []
      const pipelineIndex = pipelines.findIndex(p => p.type === activePipeline)

      if (pipelineIndex === -1) {
        // Esto no debería pasar para pipelines de BD, solo para defaults si no existen
        const newPipeline: Pipeline = {
          id: `${activePipeline}-pipeline`,
          name: activePipeline === 'sales' ? 'Sales Pipeline' :
            activePipeline === 'support' ? 'Support Pipeline' : 'Administrative Pipeline',
          type: activePipeline,
          stages: [stageToState]
        }
        return [...pipelines, newPipeline]
      }

      const updatedPipelines = [...pipelines]
      updatedPipelines[pipelineIndex] = {
        ...updatedPipelines[pipelineIndex],
        stages: [...updatedPipelines[pipelineIndex].stages, stageToState]
      }

      return updatedPipelines
    })
  }

  const handleAddLead = async (lead: Lead) => {
    try {
      // Resolver el UUID del pipeline actual
      const currentPipeline = pipelines.find(p => p.type === activePipeline)
      let pipelineIdToSave = currentPipeline?.id

      if (!pipelineIdToSave) {
        toast.error('No se ha seleccionado un pipeline válido')
        return
      }

      const payload: any = {
        nombre_completo: lead.name,
        correo_electronico: lead.email,
        telefono: lead.phone,
        empresa: lead.company,
        presupuesto: lead.budget,
        etapa_id: lead.stage,
        pipeline_id: pipelineIdToSave,
        prioridad: lead.priority,
        asignado_a: null,
        empresa_id: companyId
      }

      // Antes el formulario usaba nombre; ahora usa ID. Soportar ambos.
      // 1. Si lead.assignedTo coincide con un ID directo.
      const byId = teamMembers.find(m => m.id === lead.assignedTo)
      if (byId) {
        payload.asignado_a = byId.id
      } else {
        // 2. Intentar por nombre (legacy)
        const byName = teamMembers.find(m => m.name === lead.assignedTo)
        if (byName) {
          payload.asignado_a = byName.id
        } else if (lead.assignedTo === 'todos') {
          // 3. Asignar a todos: usar UUID nulo estándar en BD
          payload.asignado_a = '00000000-0000-0000-0000-000000000000'
        } else if (user && user.id === lead.assignedTo) {
          // 3. Asignado al usuario efectivo
          payload.asignado_a = user.id
        }
      }

      // Si el pipeline es custom (tiene UUID), intentamos guardar
      if (pipelineIdToSave) {
        // Validar que la etapa sea UUID
        const isStageUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lead.stage)

        if (!isStageUUID) {
          toast.warning('No se puede guardar en BD: La etapa no está sincronizada (ID inválido). Se guardará localmente.')
          setLeads((current) => [...(current || []), lead])
          return
        }

        const created = await createLead(payload)
        // IMPORTANTE: Usar el UUID del pipeline (pipelineIdToSave) para el estado local
        // para que coincida con el filtro de allPipelineLeads
        const newLead = {
          ...lead,
          id: created.id,
          pipeline: pipelineIdToSave || lead.pipeline
        }
        setLeads((current) => [...(current || []), newLead])
        toast.success('Lead guardado en BD')
      } else {
        // Fallback local para defaults
        setLeads((current) => [...(current || []), lead])
        toast.warning('Lead guardado localmente (Pipeline default)')
      }

    } catch (error: any) {
      console.error('Error creating lead:', error)
      toast.error(`Error al crear lead: ${error.message}`)
    }
  }

  const handleDeleteLead = async (leadId: string) => {
    try {
      // Intentar borrar de BD si parece un UUID
      if (leadId.length > 20) { // Simple check
        await deleteLead(leadId)
      }
      setLeads((current) => (current || []).filter(l => l.id !== leadId))
      setSelectedLead((current) => current?.id === leadId ? null : current)
      toast.success(t.messages.leadDeleted)
    } catch (error: any) {
      console.error('Error deleting lead:', error)
      toast.error('Error al eliminar lead')
    }
  }

  const handleDeleteStage = async (stageId: string) => {
    if (!isAdminOrOwner) {
      toast.error('No tienes permisos para eliminar etapas')
      return
    }

    // Check if it's a UUID (DB stage)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stageId)

    if (isUUID) {
      try {
        const { error } = await deleteEtapa(stageId)
        if (error) throw error
      } catch (err: any) {
        console.error('Error deleting stage:', err)
        toast.error(`Error al eliminar etapa de BD: ${err.message || err.details || 'Error desconocido'}`)
        return
      }
    }

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
    if (!isAdminOrOwner) {
      toast.error('No tienes permisos para eliminar pipelines')
      return
    }
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
    if (!canEditLeads) {
      e.preventDefault()
      return
    }
    setDraggedLead(lead)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetStageId: string) => {
    e.preventDefault()

    if (!canEditLeads) {
      toast.error('No tienes permisos para mover leads')
      return
    }

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

    // Actualizar en BD
    if (draggedLead.id.length > 20) { // Check simple de UUID
      updateLead(draggedLead.id, { etapa_id: targetStageId })
        .catch(err => {
          console.error('Error updating lead stage in DB:', err)
          toast.error(`Error al mover lead: ${err.message || 'Error desconocido'}`)
          // Revertir cambio local
          setLeads((current) =>
            (current || []).map(l => l.id === draggedLead.id ? draggedLead : l)
          )
        })
    }

    setDraggedLead(null)
    toast.success('Lead movido a nueva etapa')
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 md:p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h1 className="text-2xl md:text-3xl font-bold">{t.pipeline.title}</h1>
          <div className="flex gap-2">
            {/* Botón de búsqueda de leads */}
            <LeadSearchDialog
              leads={leads}
              onSelectLead={(lead) => setSelectedLead(lead)}
            />

            {currentPipeline && (
              <>
                {canEditLeads && (
                  <>
                    {isAdminOrOwner && (
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
                  </>
                )}
                {canEditLeads && (
                  <AddLeadDialog
                    pipelineType={activePipeline}
                    pipelineId={currentPipeline?.id}
                    stages={currentPipeline?.stages || []}
                    teamMembers={teamMembers}
                    onAdd={handleAddLead}
                    companies={companies}
                    currentUser={user}
                    companyName={currentCompany?.name}
                  />
                )}
              </>
            )}
          </div>
        </div>

        <Tabs value={activePipeline} onValueChange={(v) => setActivePipeline(v as PipelineType)}>
          <TabsList className="w-full justify-start overflow-x-auto h-auto p-1 no-scrollbar md:w-auto md:flex-wrap">
            {(pipelines || []).map(p => (
              <TabsTrigger key={p.id} value={p.type} className="text-xs md:text-sm min-w-fit whitespace-nowrap">
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
              {user && <SelectItem value="me">{currentCompany ? `${currentCompany.name} (Yo)` : 'Yo'}</SelectItem>}
              {user && <SelectItem value="me+todos">Yo + Todos</SelectItem>}
              <SelectItem value="todos">Solo Todos</SelectItem>
              {eligibleMembers.map(member => (
                <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
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

      <div className="flex-1 overflow-y-auto md:overflow-hidden bg-background/50">
        {(!pipelines || pipelines.length === 0) && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <p className="text-lg font-medium">No hay pipelines disponibles</p>
            <p className="text-sm">Ve a Configuración para crear uno nuevo.</p>
          </div>
        )}
        <div className="h-full md:overflow-x-auto px-4 md:px-6 py-4 md:py-6 pb-24 md:pb-6">
          <div className="flex flex-col md:flex-row gap-6 md:gap-4 h-auto md:h-full md:min-w-max">
            {(currentPipeline?.stages || []).map(stage => {
              const stageLeads = pipelineLeads.filter(l => l.stage === stage.id)

              return (
                <div
                  key={stage.id}
                  className="w-full md:w-80 flex flex-col shrink-0"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, stage.id)}
                >
                  <div className="flex items-center justify-between mb-3 sticky top-0 bg-background/95 backdrop-blur z-10 py-2 border-b md:border-none md:static md:bg-transparent md:z-0 md:py-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn('w-3 h-3 rounded-full shrink-0')} style={{ backgroundColor: stage.color }} />
                      <h3 className="font-semibold text-sm md:text-base truncate">{stage.name}</h3>
                      <Badge variant="secondary" className="text-xs shrink-0">{stageLeads.length}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      {isAdminOrOwner && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteStage(stage.id)}
                          title="Eliminar etapa"
                        >
                          <Trash size={16} />
                        </Button>
                      )}
                      {canEditLeads && (
                        <AddLeadDialog
                          pipelineType={activePipeline}
                          pipelineId={currentPipeline?.id}
                          stages={currentPipeline?.stages || []}
                          teamMembers={teamMembers}
                          onAdd={handleAddLead}
                          defaultStageId={stage.id}
                          companies={companies}
                          currentUser={user}
                          companyName={currentCompany?.name}
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
                      )}
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col gap-3 md:gap-2 overflow-x-auto md:overflow-x-hidden md:overflow-y-auto min-h-[120px] md:min-h-[200px] bg-muted/30 rounded-lg p-2 md:flex-1 no-scrollbar-mobile pb-4 md:pb-2">
                    {stageLeads.map(lead => (
                      <Card
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead)}
                        className="w-[85vw] sm:w-80 md:w-full shrink-0 p-2 cursor-move hover:shadow-md transition-all border-l-4 active:opacity-50"
                        style={{ borderLeftColor: stage.color }}
                        onClick={() => setSelectedLead(lead)}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-sm truncate">{lead.name}</h4>
                              <p className="text-xs text-muted-foreground truncate">{lead.company}</p>
                            </div>
                            {unreadLeads.has(lead.id) && (
                              <div className="w-2 h-2 rounded-full bg-destructive shrink-0 animate-pulse" title="Mensajes no leídos" />
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0">
                                <DotsThree size={14} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem disabled={!isAdminOrOwner}>{t.buttons.edit}</DropdownMenuItem>
                              <DropdownMenuItem disabled={!isAdminOrOwner}>Mover a Etapa</DropdownMenuItem>
                              {isAdminOrOwner && (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    handleDeleteLead(lead.id)
                                  }}
                                >
                                  {t.buttons.delete}
                                </DropdownMenuItem>
                              )}
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
                          {t.lead.assignedTo}: {(() => {
                            const NIL_UUID = '00000000-0000-0000-0000-000000000000'
                            const member = teamMembers.find(m => m.id === lead.assignedTo)
                            if (member) return member.name
                            if (lead.assignedTo === NIL_UUID || lead.assignedTo == null) {
                              return 'Todos'
                            }
                            if (user && user.id === lead.assignedTo) {
                              return `${currentCompany?.name || user.businessName || user.email} (Yo)`
                            }
                            // Si el asignado es el dueño/owner de la empresa, mostrar nombre de la empresa
                            if (currentCompany && currentCompany.ownerId === lead.assignedTo) {
                              return `${currentCompany.name} (Owner)`
                            }
                            return 'Sin asignar'
                          })()}
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
                  {isAdminOrOwner && (
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
                  )}
                </div>
              </div>
            )}

            {(currentPipeline?.stages || []).length > 0 && canEditLeads && (
              <div className="w-72 md:w-80 flex flex-col shrink-0 min-h-0">
                <AddStageDialog
                  pipelineType={activePipeline}
                  currentStagesCount={currentPipeline?.stages.length || 0}
                  onAdd={handleAddStage}
                  trigger={
                    <div className="flex-1 space-y-2 overflow-y-auto min-h-[200px] bg-muted/20 rounded-lg p-2 border-2 border-dashed border-border hover:border-primary transition-colores cursor-pointer flex flex-col items-center justify-center" title={t.pipeline.addStage}>
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
          onUpdate={async (updated) => {
            if (!canEditLeads) {
              toast.error('No tienes permisos para editar leads')
              return
            }
            try {
              const NIL_UUID = '00000000-0000-0000-0000-000000000000'
              await updateLead(updated.id, {
                nombre_completo: updated.name,
                empresa: updated.company,
                correo_electronico: updated.email,
                telefono: updated.phone,
                prioridad: updated.priority,
                presupuesto: updated.budget,
                asignado_a: updated.assignedTo === 'todos' ? NIL_UUID : updated.assignedTo || NIL_UUID
              })

              // Actualizamos estado local (aunque el realtime debería hacerlo también)
              setLeads((current) =>
                (current || []).map(l => l.id === updated.id ? updated : l)
              )
              setSelectedLead(updated)
              toast.success('Lead actualizado')
            } catch (error: any) {
              console.error('Error updating lead:', error)
              toast.error('Error al actualizar lead')
            }
          }}
          onMarkAsRead={(leadId) => {
            // Marcar mensajes como leídos y actualizar UI localmente
            // La actualización en BD se hace dentro de LeadDetailSheet o podríamos llamarla aquí
            setUnreadLeads(prev => {
              const newSet = new Set(prev)
              newSet.delete(leadId)
              return newSet
            })
          }}
          teamMembers={teamMembers}
          canEdit={canEditLeads}
          currentUser={user}
        />
      )}
    </div>
  )
}
