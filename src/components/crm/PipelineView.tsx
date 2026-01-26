import { useEffect, useState, useRef } from 'react'
import { useLeadsRealtime } from '@/hooks/useLeadsRealtime'
import { usePipelineData } from '@/hooks/usePipelineData'
import { usePipelineLeadActions } from '@/hooks/usePipelineLeadActions'
import { useDragDrop } from '@/hooks/useDragDrop'
import { Lead, Pipeline, PipelineType, TeamMember, Stage } from '@/lib/types'
// import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, Funnel, Trash, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { LeadDetailSheet } from './LeadDetailSheet'
import { AddStageDialog } from './AddStageDialog'
import { AddLeadDialog } from './AddLeadDialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'
import { deletePipeline, getPipelines } from '@/supabase/helpers/pipeline'
import { deleteLead, getLeads, getLeadsPaged, updateLead, searchLeads } from '@/supabase/services/leads'
import { getEquipos } from '@/supabase/services/equipos'
import { getPersonas } from '@/supabase/services/persona'
import { getPipelinesForPersona } from '@/supabase/helpers/personaPipeline'
import { createEtapa, deleteEtapa } from '@/supabase/helpers/etapas'
import { getUnreadMessagesCount, subscribeToAllMessages, markMessagesAsRead } from '@/supabase/services/mensajes'
import { getNotasCountByLeads } from '@/supabase/services/notas'
import { supabase } from '@/lib/supabase'

import { Building } from '@phosphor-icons/react'
import { PipelineBoard } from './pipeline/PipelineBoard'
import { Company } from './CompanyManagement'
import { LeadSearchDialog } from './LeadSearchDialog'
import { useIsMobile } from '@/hooks/use-mobile'

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

  // ==========================================
  // HOOK: Datos del pipeline (pipelines, leads, paginación)
  // ==========================================
  const {
    pipelines,
    leads,
    activePipeline,
    setActivePipeline,
    currentPipeline,
    stageCounts,
    stagePages,
    unreadLeads,
    notasCounts,
    isLoadingMore: isLoadingMoreAll,
    hasMore: pipelineHasMore,
    loadMoreStage: handleLoadMoreStage,
    loadMoreAll: handleLoadMoreAll,
    setLeads,
    setStageCounts,
    setPipelines,
    setUnreadLeads,
    setNotasCounts
  } = usePipelineData({
    companyId,
    userId: user?.id,
    canViewAllLeads: true // Cambiar según permisos
  })

  // Estados UI locales (no manejados por hooks)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [filterByMember, setFilterByMember] = useState<string>('all')
  const isMobile = useIsMobile()
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [moveDialogLead, setMoveDialogLead] = useState<Lead | null>(null)
  const [highlightedLeadId, setHighlightedLeadId] = useState<string | null>(null)
  const tabsScrollRef = useRef<HTMLDivElement>(null)

  // Ref para acceso síncrono a leads (usado por realtime)
  const leadsRef = useRef(leads)
  useEffect(() => {
    leadsRef.current = leads
  }, [leads])

  // Leer leadId de sessionStorage para navegar a él (viene de ChatsView "Ver en Leads")
  useEffect(() => {
    if (leads.length === 0) return

    const openLeadId = sessionStorage.getItem('openLeadId')
    if (!openLeadId) return

    // Limpiar sessionStorage inmediatamente
    sessionStorage.removeItem('openLeadId')

    // Buscar el lead
    const targetLead = leads.find(l => l.id === openLeadId)
    if (!targetLead) {
      console.log('[PipelineView] Lead no encontrado:', openLeadId)
      return
    }

    // Cambiar al pipeline correcto si es necesario
    const leadPipeline = pipelines.find(p => p.id === targetLead.pipeline || p.type === targetLead.pipeline)
    if (leadPipeline && leadPipeline.type !== activePipeline) {
      setActivePipeline(leadPipeline.type)
    }

    // Destacar el lead
    setHighlightedLeadId(openLeadId)

    // Hacer scroll al lead después de un delay para que el DOM se actualice
    setTimeout(() => {
      const leadCard = document.getElementById(`lead-card-${openLeadId}`)
      if (leadCard) {
        leadCard.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
      }
    }, 500)

    // Quitar highlight después de 4 segundos
    setTimeout(() => setHighlightedLeadId(null), 4000)
  }, [leads, pipelines])

  const currentCompany = companies.find(c => c.id === companyId)
  const userRole = currentCompany?.role || 'viewer'

  /**
   * VISIBILIDAD DE LEADS SEGÚN ROL
   * 
   * Opciones de configuración (modificar canViewAllLeads):
   * 
   * 1. TODOS VEN TODO (configuración actual):
   *    const canViewAllLeads = true
   * 
   * 2. SOLO ADMIN/OWNER VEN TODO (viewers solo ven sus leads asignados):
   *    const canViewAllLeads = userRole === 'admin' || userRole === 'owner'
   * 
   * 3. ADMIN VE TODO, VIEWER VE SUS LEADS + LOS DE "TODOS":
   *    const canViewAllLeads = userRole === 'admin' || userRole === 'owner'
   *    (El servicio leads.ts ya filtra por asignado_a cuando isAdminOrOwner=false)
   * 
   * 4. ROL ESPECÍFICO CON VISTA COMPLETA:
   *    const canViewAllLeads = ['admin', 'owner', 'lector_completo'].includes(userRole)
   */
  const canViewAllLeads = true // Cambiar a la opción deseada arriba

  const isAdminOrOwner = userRole === 'admin' || userRole === 'owner'
  // Viewers ahora pueden crear y editar leads, pero no eliminar ni gestionar pipelines
  const canEditLeads = true

  // ==========================================
  // HOOK: Acciones del Pipeline (CRUD leads/stages)
  // ==========================================
  const {
    handleAddStage,
    handleAddLead,
    handleImportLeads,
    handleDeleteLead
  } = usePipelineLeadActions({
    companyId: companyId || '',
    activePipeline,
    pipelines,
    setPipelines,
    setLeads,
    setStageCounts,
    teamMembers,
    user,
    isAdminOrOwner,
    currentCompany
  })

  // ==========================================
  // HOOK: Drag & Drop con Optimistic UI
  // ==========================================
  const {
    draggedLeadRef,
    handleDragStart,
    handleDragOver,
    handleDrop,
    moveLead: handleMoveLead
  } = useDragDrop({
    setLeads,
    setStageCounts,
    canEditLeads
  })

  // Sincronización en tiempo real de leads
  useLeadsRealtime({
    companyId: companyId || '',
    onInsert: (lead) => {
      let added = false
      setLeads((current) => {
        // Evitar duplicados
        if (current.find(l => l.id === lead.id)) return current
        added = true
        return [...current, lead]
      })
      if (!added) return
      setStageCounts(prev => ({
        ...prev,
        [lead.stage]: (prev[lead.stage] || 0) + 1
      }))
      toast.success(`Nuevo lead agregado: ${lead.name}`)
    },
    onUpdate: (lead) => {
      const oldLead = leadsRef.current.find(l => l.id === lead.id)
      if (oldLead && oldLead.stage !== lead.stage) {
        setStageCounts(prev => ({
          ...prev,
          [oldLead.stage]: Math.max(0, (prev[oldLead.stage] || 0) - 1),
          [lead.stage]: (prev[lead.stage] || 0) + 1
        }))
      }
      setLeads((current) => current.map(l => l.id === lead.id ? lead : l));
      toast.info(`Lead actualizado: ${lead.name}`);
    },
    onDelete: (leadId) => {
      const leadToDelete = leadsRef.current.find(l => l.id === leadId)
      if (leadToDelete) {
        setStageCounts(prev => ({
          ...prev,
          [leadToDelete.stage]: Math.max(0, (prev[leadToDelete.stage] || 0) - 1)
        }))
      }
      setLeads((current) => current.filter(l => l.id !== leadId));
      toast.error(`Lead eliminado`);
    }
  });

  // Cargar miembros del equipo desde BD para tener pipelines actualizados
  useEffect(() => {
    if (!companyId) return
    let cancelled = false

      ; (async () => {
        try {
          const equipos = await getEquipos(companyId)
          if (cancelled) return

          const equiposIds = equipos.map(e => e.id)
          const allPersonas = await Promise.all(equiposIds.map(id => getPersonas(id)))
          if (cancelled) return

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
              name: p.nombre || 'Sin Nombre',
              email: p.email,
              avatar: '',
              role: p.titulo_trabajo || '',
              teamId: p.equipo_id || undefined,
              pipelines: memberPipelines,
              userId: p.usuario_id || undefined
            }
          }))

          if (!cancelled) setTeamMembers(mapped)
        } catch (e) {
          console.error('Error loading team members in PipelineView', e)
        }
      })()

    return () => { cancelled = true }
  }, [companyId])

  // ==========================================
  // NOTA: loadPipelines, loadLeads, handleLoadMoreStage, handleLoadMoreAll,
  // y la subscripción a mensajes no leídos ahora viven en usePipelineData.
  // Se eliminaron ~340 líneas de código duplicado.
  // ==========================================


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









  const handleDeleteMultipleLeads = async (ids: string[]) => {
    // Optimistic delete or parallel delete
    await Promise.all(ids.map(id => deleteLead(id)))

    setLeads((current) => {
      const leadsToDelete = current.filter(l => ids.includes(l.id))

      if (leadsToDelete.length > 0) {
        setStageCounts(prev => {
          const next = { ...prev }
          leadsToDelete.forEach(l => {
            next[l.stage] = Math.max(0, (next[l.stage] || 0) - 1)
          })
          return next
        })
      }
      return current.filter(l => !ids.includes(l.id))
    })

    // Si el seleccionado fue eliminado, cerrarlo
    setSelectedLead((current) => current && ids.includes(current.id) ? null : current)
  }

  const handleDeleteStage = async (stageId: string) => {
    if (!isAdminOrOwner) {
      toast.error('No tienes permisos para eliminar etapas')
      return
    }

    if (!window.confirm('¿Quieres eliminar la etapa? Se eliminarán todos los leads en ella.')) {
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

  // ==========================================
  // NOTA: handleMoveLead, handleDragStart, handleDragOver, handleDrop
  // ahora viven en useDragDrop hook.
  // Se eliminaron ~110 líneas de código duplicado.
  // ==========================================

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 md:p-6 border-b border-border bg-gradient-to-r from-background via-background to-muted/20">
        {/* Header Row - Title and Actions */}
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-3 shrink-0">
            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-primary to-primary/40" />
            <h1 className="text-xl md:text-2xl font-bold text-foreground">{t.pipeline.title}</h1>
          </div>

          {/* Action Buttons - Modern Compact Design */}
          <div className="flex items-center gap-1.5 md:gap-2">
            {/* Search Button */}
            <LeadSearchDialog
              leads={leads}
              onSelectLead={(lead) => setSelectedLead(lead)}
              canDelete={isAdminOrOwner}
              onDeleteLeads={handleDeleteMultipleLeads}
              onSearch={async (term) => {
                const currentPipelineObj = pipelines.find(p => p.type === activePipeline)
                const currentPipelineId = currentPipelineObj?.id
                try {
                  const results = await searchLeads(companyId!, term, {
                    pipelineId: currentPipelineId,
                    archived: false,
                    limit: 100,
                    order: 'desc'
                  })
                  return (results || []).map((l: any) => ({
                    id: l.id,
                    name: l.nombre_completo,
                    email: l.correo_electronico,
                    phone: l.telefono,
                    company: l.empresa,
                    location: l.ubicacion,
                    budget: l.presupuesto,
                    stage: l.etapa_id,
                    pipeline: l.pipeline_id || 'sales',
                    priority: l.prioridad,
                    assignedTo: l.asignado_a,
                    tags: l.tags || [],
                    createdAt: new Date(l.created_at),
                    lastContact: new Date(l.created_at)
                  }))
                } catch (err) {
                  console.error('[PipelineView] Error searching leads:', err)
                  return []
                }
              }}
              onNavigateToLead={(lead) => {
                // Cambiar al pipeline correcto
                const leadPipeline = pipelines.find(p => p.id === lead.pipeline || p.type === lead.pipeline)
                if (leadPipeline) {
                  setActivePipeline(leadPipeline.type)
                }
                // Insertar el lead temporalmente si no está en memoria para poder navegar
                setLeads((current) => {
                  const exists = (current || []).some(l => l.id === lead.id)
                  if (exists) return current
                  return [...(current || []), lead]
                })
                // Destacar el lead temporalmente
                setHighlightedLeadId(lead.id)

                // Hacer scroll al lead después de un pequeño delay para que el pipeline cambie
                setTimeout(() => {
                  const leadCard = document.getElementById(`lead-card-${lead.id}`)
                  if (leadCard) {
                    leadCard.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
                  }
                }, 300)

                // Quitar highlight después de 4 segundos
                setTimeout(() => setHighlightedLeadId(null), 4000)
              }}
            />

            {currentPipeline && (
              <>
                {canEditLeads && isAdminOrOwner && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                        title="Eliminar Pipeline"
                      >
                        <Trash size={16} />
                        <span className="hidden lg:inline ml-1.5 text-xs">Eliminar</span>
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

                {canEditLeads && (
                  <AddStageDialog
                    pipelineType={activePipeline}
                    currentStagesCount={currentPipeline?.stages.length || 0}
                    onAdd={handleAddStage}
                    trigger={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                        title="Agregar Etapa"
                      >
                        <Plus size={16} />
                        <span className="hidden lg:inline ml-1.5 text-xs">Etapa</span>
                      </Button>
                    }
                  />
                )}

                {canEditLeads && (
                  <AddLeadDialog
                    pipelineType={activePipeline}
                    pipelineId={currentPipeline?.id}
                    stages={currentPipeline?.stages || []}
                    teamMembers={teamMembers}
                    onAdd={handleAddLead}
                    onImport={handleImportLeads}
                    companies={companies}
                    currentUser={user}
                    companyName={currentCompany?.name}
                    companyId={companyId}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Pipeline Tabs - Horizontal scroll with arrows */}
        <Tabs value={activePipeline} onValueChange={(v) => setActivePipeline(v as PipelineType)}>
          <div className="relative group">
            <div
              ref={tabsScrollRef}
              className="overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none hover:scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent transition-all"
            >
              <TabsList className="inline-flex flex-nowrap h-11 items-center justify-start gap-2 bg-muted/30 p-1.5 rounded-xl w-max min-w-full">
                {(pipelines || []).map(p => (
                  <TabsTrigger
                    key={p.id}
                    value={p.type}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-5 py-2 text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md hover:bg-background/40 hover:text-foreground"
                  >
                    {p.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {/* Gradient fade indicators for scroll */}
            <div className="absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-background via-background/80 to-transparent pointer-events-none" />
            <div className="absolute left-0 top-0 bottom-2 w-12 bg-gradient-to-r from-background via-background/80 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
              <button
                type="button"
                className="hidden md:flex h-9 w-9 items-center justify-center rounded-full bg-background shadow-sm border border-border/60 text-muted-foreground hover:text-foreground hover:shadow-md transition-all active:scale-95"
                onClick={() => tabsScrollRef.current?.scrollBy({ left: -((tabsScrollRef.current?.clientWidth || 200) * 0.8), behavior: 'smooth' })}
                aria-label="Desplazar pipelines a la izquierda"
              >
                <CaretLeft size={18} weight="bold" />
              </button>
              <button
                type="button"
                className="h-9 w-9 flex items-center justify-center rounded-full bg-background shadow-sm border border-border/60 text-muted-foreground hover:text-foreground hover:shadow-md transition-all active:scale-95"
                onClick={() => tabsScrollRef.current?.scrollBy({ left: (tabsScrollRef.current?.clientWidth || 200) * 0.8, behavior: 'smooth' })}
                aria-label="Desplazar pipelines a la derecha"
              >
                <CaretRight size={18} weight="bold" />
              </button>
            </div>
          </div>
        </Tabs>

        {/* Filter Section */}
        <div className="flex items-center gap-3 mt-2">
          <Select value={filterByMember} onValueChange={setFilterByMember}>
            <SelectTrigger className="w-auto min-w-[200px] h-9 px-3 bg-muted/50 border-0 rounded-lg text-sm hover:bg-muted transition-colors">
              <div className="flex items-center gap-2">
                <Funnel size={16} className="text-muted-foreground shrink-0" />
                <SelectValue placeholder="Filtrar por miembro" />
              </div>
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
            <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-xs">
              {pipelineLeads.length} de {allPipelineLeads.length} leads
            </Badge>
          )}
        </div>
      </div>

      <PipelineBoard
        currentPipeline={currentPipeline}
        pipelines={pipelines}
        pipelineLeads={pipelineLeads}
        allPipelineLeads={allPipelineLeads}
        stageCounts={stageCounts}
        stagePages={stagePages}
        unreadLeads={unreadLeads}
        notasCounts={notasCounts}
        highlightedLeadId={highlightedLeadId}
        isAdminOrOwner={isAdminOrOwner}
        canEditLeads={canEditLeads}
        isMobile={isMobile}
        activePipeline={activePipeline}
        teamMembers={teamMembers}
        currentCompany={currentCompany}
        user={user}
        companies={companies}
        companyId={companyId}
        onAddStage={handleAddStage}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDeleteStage={handleDeleteStage}
        onAddLead={handleAddLead}
        onImportLeads={handleImportLeads}
        onLoadMore={handleLoadMoreStage}
        onDragStart={handleDragStart}
        onLeadClick={(lead) => setSelectedLead(lead)}
        onDeleteLead={handleDeleteLead}
        onMoveToStage={handleMoveLead}
        onOpenMoveDialog={(lead) => {
          setMoveDialogLead(lead)
          setMoveDialogOpen(true)
        }}
        t={t}
      />

      {/* Botón inferior eliminado: ahora hay botones arriba y por etapa */}

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

            // Optimistic update: actualizar UI inmediatamente
            setLeads((current) =>
              (current || []).map(l => l.id === updated.id ? updated : l)
            )
            const prevSelected = selectedLead
            setSelectedLead(updated)

            // Guardar en BD en segundo plano
            try {
              const NIL_UUID = '00000000-0000-0000-0000-000000000000'
              await updateLead(updated.id, {
                nombre_completo: updated.name,
                empresa: updated.company,
                correo_electronico: updated.email,
                telefono: updated.phone,
                ubicacion: updated.location,
                prioridad: updated.priority,
                presupuesto: updated.budget,
                asignado_a: updated.assignedTo === 'todos' ? NIL_UUID : updated.assignedTo || NIL_UUID,
                tags: updated.tags || []
              })

              // Si cambió la asignación y aplica, enviar notificación
              const assignmentChanged = prevSelected && prevSelected.assignedTo !== updated.assignedTo
              const newAssignedId = (updated.assignedTo === 'todos' ? NIL_UUID : updated.assignedTo) || NIL_UUID
              if (assignmentChanged && isAdminOrOwner && newAssignedId && newAssignedId !== NIL_UUID) {
                const recipient = teamMembers.find(m => m.id === newAssignedId)
                if (recipient?.email) {
                  try {
                    await supabase.functions.invoke('send-lead-assigned', {
                      body: {
                        leadId: updated.id,
                        leadName: updated.name,
                        empresaId: companyId,
                        empresaNombre: currentCompany?.name,
                        assignedUserId: recipient?.userId || newAssignedId,
                        assignedUserEmail: recipient?.email,
                        assignedByEmail: user?.email,
                        assignedByNombre: user?.businessName || currentCompany?.name || user?.email
                      }
                    })
                  } catch (e) {
                    console.error('[PipelineView] Error enviando notificación de asignación', e)
                  }
                }
              }
            } catch (error: any) {
              console.error('Error updating lead:', error)
              toast.error('Error al guardar cambios')
              // Opcionalmente podrías revertir el optimistic update aquí
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
          companyId={companyId}
          canDeleteLead={isAdminOrOwner}
          onDeleteLead={(id) => handleDeleteLead(id, () => setSelectedLead(null))}
        />
      )}

      {/* Mobile: Move to Stage dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mover a Etapa</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            {(currentPipeline?.stages || []).map((s) => (
              <Button
                key={s.id}
                variant={moveDialogLead?.stage === s.id ? 'secondary' : 'outline'}
                className="justify-start"
                disabled={!moveDialogLead || moveDialogLead.stage === s.id}
                onClick={() => {
                  if (!moveDialogLead) return
                  handleMoveLead(moveDialogLead, s.id)
                  setMoveDialogOpen(false)
                  setMoveDialogLead(null)
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name}
                </span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
