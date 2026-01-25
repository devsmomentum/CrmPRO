import { useEffect, useState, useRef } from 'react'
import { useLeadsRealtime } from '@/hooks/useLeadsRealtime';
// import { useKV } from '@github/spark/hooks'
import { usePersistentState } from '@/hooks/usePersistentState'
import { Lead, Pipeline, Stage, PipelineType, TeamMember } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, DotsThree, Funnel, Trash, Note, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { LeadDetailSheet } from './LeadDetailSheet'
import { AddStageDialog } from './AddStageDialog'
import { AddLeadDialog } from './AddLeadDialog'
import { ExcelImportDialog } from './ExcelImportDialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'
import { deletePipeline, getPipelines } from '@/supabase/helpers/pipeline'
import { createLead, deleteLead, getLeads, getLeadsPaged, updateLead, searchLeads } from '@/supabase/services/leads'
import { getEquipos } from '@/supabase/services/equipos'
import { getPersonas } from '@/supabase/services/persona'
import { getPipelinesForPersona } from '@/supabase/helpers/personaPipeline'
import { createEtapa, deleteEtapa } from '@/supabase/helpers/etapas'
import { getUnreadMessagesCount, subscribeToAllMessages, markMessagesAsRead } from '@/supabase/services/mensajes'
import { getNotasCountByLeads } from '@/supabase/services/notas'
import { supabase } from '@/lib/supabase'

import { Building } from '@phosphor-icons/react'
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

  const [leads, setLeads] = useState<Lead[]>([])
  const [pipelines, setPipelines] = usePersistentState<Pipeline[]>(`pipelines-${companyId}`, [])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [activePipeline, setActivePipeline] = useState<PipelineType>('sales')
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null)
  const [filterByMember, setFilterByMember] = useState<string>('all')
  const [unreadLeads, setUnreadLeads] = useState<Set<string>>(new Set())
  const [pipelineOffset, setPipelineOffset] = useState(0)
  const [pipelineHasMore, setPipelineHasMore] = useState(false)
  const [isLoadingMoreAll, setIsLoadingMoreAll] = useState(false)
  const [stagePages, setStagePages] = useState<Record<string, { offset: number; hasMore: boolean }>>({})
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({})
  const isMobile = useIsMobile()
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [moveDialogLead, setMoveDialogLead] = useState<Lead | null>(null)
  const [highlightedLeadId, setHighlightedLeadId] = useState<string | null>(null)
  const [notasCounts, setNotasCounts] = useState<Record<string, number>>({})
  const tabsScrollRef = useRef<HTMLDivElement>(null)

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

          const equiposIds = (equipos as any[]).map(e => e.id)
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
              name: p.nombre,
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

  // Cargar pipelines y luego leads paginados por pipeline
  useEffect(() => {
    if (!companyId) return
    let cancelled = false

    // Cargar pipelines de BD
    getPipelines(companyId)
      .then(({ data }) => {
        if (cancelled) return

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

          // Deduplicar por ID y por nombre (para evitar mostrar duplicados creados accidentalmente)
          const seenIds = new Set<string>()
          const seenNames = new Set<string>()
          const uniquePipelines = dbPipelines.filter(p => {
            if (seenIds.has(p.id)) return false
            const normalizedName = p.name.toLowerCase().trim()
            if (seenNames.has(normalizedName)) {
              console.warn(`[PipelineView] Pipeline duplicado por nombre detectado: "${p.name}" (ID: ${p.id})`)
              return false
            }
            seenIds.add(p.id)
            seenNames.add(normalizedName)
            return true
          })

          setPipelines(uniquePipelines)

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

    return () => { cancelled = true }
  }, [companyId])

  // Carga inicial: 100 leads por etapa al cambiar de pipeline
  useEffect(() => {
    if (!companyId || !pipelines || pipelines.length === 0) return
    const currentPipelineObj = pipelines.find(p => p.type === activePipeline)
    if (!currentPipelineObj?.id) return

    let cancelled = false

    const BASE_STAGE_LIMIT = 100
    const stages = currentPipelineObj.stages || []

    setStagePages({})
    setPipelineOffset(0)
    setPipelineHasMore(false)

    Promise.all(
      stages.map(async (s) => {
        const { data, count } = await getLeadsPaged({
          empresaId: companyId,
          currentUserId: user?.id,
          isAdminOrOwner: canViewAllLeads, // Usa canViewAllLeads para visibilidad
          limit: BASE_STAGE_LIMIT,
          offset: 0,
          pipelineId: currentPipelineObj.id,
          stageId: s.id,
          order: 'desc'
        })
        return { stageId: s.id, data: data || [], count: count || 0 }
      })
    )
      .then((results) => {
        // Si cambió la empresa/pipeline mientras cargaba, ignorar resultados
        if (cancelled) return

        const mappedAll = results.flatMap(({ data }) =>
          data.map((l: any) => ({
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
        )

        const byId = new Map<string, any>()
        mappedAll.forEach(l => byId.set(l.id, l))
        const unique = Array.from(byId.values())
        setLeads(unique)

        // Cargar conteos de notas en segundo plano
        if (unique.length > 0) {
          getNotasCountByLeads(unique.map(l => l.id))
            .then(counts => { if (!cancelled) setNotasCounts(counts) })
            .catch(err => console.warn('[PipelineView] Error cargando conteos de notas:', err))
        }

        const nextStagePages: Record<string, { offset: number; hasMore: boolean }> = {}
        const nextStageCounts: Record<string, number> = {}
        stages.forEach((s) => {
          const result = results.find(r => r.stageId === s.id)
          const fetchedForStage = result?.data?.length || 0
          nextStagePages[s.id] = {
            offset: fetchedForStage,
            hasMore: fetchedForStage === BASE_STAGE_LIMIT,
          }
          nextStageCounts[s.id] = result?.count || 0
        })
        setStagePages(nextStagePages)
        setStageCounts(nextStageCounts)

        // Calcular si quedan más a nivel pipeline
        getLeadsPaged({
          empresaId: companyId,
          currentUserId: user?.id,
          isAdminOrOwner: canViewAllLeads,
          limit: 1,
          offset: 0,
          pipelineId: currentPipelineObj.id,
          order: 'desc'
        })
          .then(({ count }) => {
            if (cancelled) return
            if (typeof count === 'number') {
              setPipelineHasMore(count > unique.length)
              setPipelineOffset(unique.length)
            }
          })
          .catch((err) => console.error('Error counting leads:', err))
      })
      .catch(err => console.error('Error loading leads by stage:', err))

    return () => { cancelled = true }
  }, [companyId, activePipeline, pipelines, canViewAllLeads, user?.id])

  const handleLoadMoreStage = async (stageId: string) => {
    if (!companyId || !pipelines) return
    const currentPipelineObj = pipelines.find(p => p.type === activePipeline)
    if (!currentPipelineObj?.id) return

    const current = stagePages[stageId] || { offset: 0, hasMore: true }
    if (!current.hasMore) return

    const STAGE_PAGE_SIZE = 100
    try {
      const { data, count } = await getLeadsPaged({
        empresaId: companyId,
        currentUserId: user?.id,
        isAdminOrOwner: canViewAllLeads,
        limit: STAGE_PAGE_SIZE,
        offset: current.offset,
        pipelineId: currentPipelineObj.id,
        stageId,
        order: 'desc'
      })
      const mapped = (data || []).map((l: any) => ({
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

      setLeads((prev) => {
        const byId = new Set((prev || []).map(l => l.id))
        const toAdd = mapped.filter(l => !byId.has(l.id))
        return [...(prev || []), ...toAdd]
      })
      const fetched = mapped.length
      setStagePages((prev) => ({
        ...prev,
        [stageId]: { offset: current.offset + fetched, hasMore: fetched === STAGE_PAGE_SIZE }
      }))
      if (typeof count === 'number') {
        setStageCounts((prev) => ({
          ...prev,
          [stageId]: count
        }))
      }
      setPipelineOffset((prev) => prev + fetched)
    } catch (err) {
      console.error('Error loading more leads for stage:', err)
    }
  }

  const handleLoadMoreAll = async () => {
    if (!companyId || !pipelines || isLoadingMoreAll) return
    const currentPipelineObj = pipelines.find(p => p.type === activePipeline)
    if (!currentPipelineObj?.id) return

    setIsLoadingMoreAll(true)
    const STAGE_PAGE_SIZE = 100
    try {
      const stages = currentPipelineObj.stages || []
      // Preparar cargas por etapa respetando su offset actual
      const loads = stages.map((s) => {
        const current = stagePages[s.id] || { offset: 0, hasMore: true }
        if (!current.hasMore) return Promise.resolve({ stageId: s.id, data: [] as any[] })
        return getLeadsPaged({
          empresaId: companyId,
          currentUserId: user?.id,
          isAdminOrOwner: canViewAllLeads,
          limit: STAGE_PAGE_SIZE,
          offset: current.offset,
          pipelineId: currentPipelineObj.id,
          stageId: s.id,
          order: 'desc'
        }).then(({ data }) => ({ stageId: s.id, data: data || [] }))
      })

      const results = await Promise.all(loads)

      // Mapear y unificar leads nuevos
      const mappedAll = results.flatMap(({ data }) =>
        (data || []).map((l: any) => ({
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
      )

      setLeads((current) => {
        const byId = new Set((current || []).map(l => l.id))
        const toAdd = mappedAll.filter(l => !byId.has(l.id))
        return [...(current || []), ...toAdd]
      })

      // Actualizar paginación por etapa y estado global de "hay más"
      setStagePages((prev) => {
        const next = { ...prev }
        results.forEach(({ stageId, data }) => {
          const fetched = (data || []).length
          const current = prev[stageId] || { offset: 0, hasMore: true }
          next[stageId] = {
            offset: current.offset + fetched,
            hasMore: fetched === STAGE_PAGE_SIZE
          }
        })
        return next
      })

      // Si al menos una etapa tiene más, mantenemos el botón activo
      const anyHasMore = results.some(({ data }) => (data || []).length === STAGE_PAGE_SIZE)
      setPipelineHasMore(anyHasMore)
    } catch (err) {
      console.error('Error loading more leads (all):', err)
    } finally {
      setIsLoadingMoreAll(false)
    }
  }

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
        ubicacion: lead.location,
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
          setStageCounts(prev => ({
            ...prev,
            [lead.stage]: (prev[lead.stage] || 0) + 1
          }))
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
        // setLeads((current) => [...(current || []), newLead])
        // Comentado para evitar duplicados en UI (Realtime lo agregará)
        toast.success('Lead guardado en BD')

        // Notificar asignación si corresponde (solo admin/owner y asignado específico)
        const NIL_UUID = '00000000-0000-0000-0000-000000000000'
        const assignedId = payload.asignado_a
        if (isAdminOrOwner && assignedId && assignedId !== NIL_UUID) {
          const recipient = teamMembers.find(m => m.id === assignedId)
          if (recipient?.email) {
            try {
              await supabase.functions.invoke('send-lead-assigned', {
                body: {
                  leadId: created.id,
                  leadName: lead.name,
                  empresaId: companyId,
                  empresaNombre: currentCompany?.name,
                  assignedUserId: recipient?.userId || assignedId,
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
      } else {
        // Fallback local para defaults
        setLeads((current) => [...(current || []), lead])
        setStageCounts(prev => ({
          ...prev,
          [lead.stage]: (prev[lead.stage] || 0) + 1
        }))
        toast.warning('Lead guardado localmente (Pipeline default)')
      }

    } catch (error: any) {
      console.error('Error creating lead:', error)
      toast.error(`Error al crear lead: ${error.message}`)
    }
  }

  const handleImportLeads = (importedLeads: Lead[]) => {
    if (!importedLeads || importedLeads.length === 0) return

    const stageIncrements: Record<string, number> = {}

    setLeads((current) => {
      const byId = new Map<string, Lead>()
      const currentPipeline = pipelines.find(p => p.type === activePipeline)

        ; (current || []).forEach(l => byId.set(l.id, l))

      importedLeads.forEach((lead) => {
        const normalizedLead = {
          ...lead,
          pipeline: lead.pipeline || currentPipeline?.id || activePipeline
        }

        if (!byId.has(normalizedLead.id)) {
          stageIncrements[normalizedLead.stage] = (stageIncrements[normalizedLead.stage] || 0) + 1
        }

        byId.set(normalizedLead.id, normalizedLead)
      })

      return Array.from(byId.values())
    })

    if (Object.keys(stageIncrements).length > 0) {
      setStageCounts((prev) => {
        const next = { ...prev }
        Object.entries(stageIncrements).forEach(([stageId, count]) => {
          next[stageId] = (next[stageId] || 0) + count
        })
        return next
      })
    }
  }

  const handleDeleteLead = async (leadId: string) => {
    try {
      // Intentar borrar de BD si parece un UUID
      if (leadId.length > 20) { // Simple check
        await deleteLead(leadId)
      }

      // Encontrar el lead antes de borrarlo para saber su etapa
      setLeads((current) => {
        const lead = current?.find(l => l.id === leadId)
        if (lead) {
          setStageCounts(prev => ({
            ...prev,
            [lead.stage]: Math.max(0, (prev[lead.stage] || 0) - 1)
          }))
        }
        return (current || []).filter(l => l.id !== leadId)
      })

      setSelectedLead((current) => current?.id === leadId ? null : current)
      toast.success(t.messages.leadDeleted)
    } catch (error: any) {
      console.error('Error deleting lead:', error)
      toast.error('Error al eliminar lead')
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

  const handleMoveLead = async (lead: Lead, targetStageId: string) => {
    if (!canEditLeads) {
      toast.error('No tienes permisos para mover leads')
      return
    }

    if (lead.stage === targetStageId) {
      return
    }

    const updatedLead = {
      ...lead,
      stage: targetStageId
    }

    setLeads((current) =>
      (current || []).map(l => l.id === lead.id ? updatedLead : l)
    )

    // Actualizar conteos optimísticamente
    setStageCounts(prev => ({
      ...prev,
      [lead.stage]: Math.max(0, (prev[lead.stage] || 0) - 1),
      [targetStageId]: (prev[targetStageId] || 0) + 1
    }))

    // Actualizar en BD
    if (lead.id.length > 20) { // Check simple de UUID
      try {
        await updateLead(lead.id, { etapa_id: targetStageId })
        toast.success('Lead movido a nueva etapa')
      } catch (err: any) {
        console.error('Error updating lead stage in DB:', err)
        toast.error(`Error al mover lead: ${err.message || 'Error desconocido'}`)
        // Revertir cambio local
        setLeads((current) =>
          (current || []).map(l => l.id === lead.id ? lead : l)
        )
      }
    } else {
      toast.success('Lead movido a nueva etapa (local)')
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

    // Actualizar conteos optimísticamente
    setStageCounts(prev => ({
      ...prev,
      [draggedLead.stage]: Math.max(0, (prev[draggedLead.stage] || 0) - 1),
      [targetStageId]: (prev[targetStageId] || 0) + 1
    }))

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
              const totalStageLeads = stageCounts[stage.id] ?? allPipelineLeads.filter(l => l.stage === stage.id).length
              const remainingStageLeads = Math.max(0, totalStageLeads - stageLeads.length)

              return (
                <div
                  key={stage.id}
                  className="w-full md:w-80 flex flex-col shrink-0"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, stage.id)}
                >
                  {/* Stage Header - Title Row */}
                  <div className="sticky top-0 bg-background/95 backdrop-blur z-10 py-2 border-b md:border-none md:static md:bg-transparent md:z-0 md:py-0 mb-3">
                    {/* Row 1: Stage Name and Count */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className={cn('w-3 h-3 rounded-full shrink-0')} style={{ backgroundColor: stage.color }} />
                        <h3 className="font-semibold text-sm md:text-base truncate max-w-[120px]" title={stage.name}>{stage.name}</h3>
                        <Badge variant="secondary" className="text-xs shrink-0">{totalStageLeads}</Badge>
                      </div>
                      {/* Action buttons on the right of title row */}
                      <div className="flex items-center gap-1 shrink-0">
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
                            onImport={handleImportLeads}
                            defaultStageId={stage.id}
                            companies={companies}
                            currentUser={user}
                            companyName={currentCompany?.name}
                            companyId={companyId}
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

                    {/* Row 2: Load More Controls */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleLoadMoreStage(stage.id)}
                        disabled={!stagePages[stage.id]?.hasMore}
                        title={remainingStageLeads > 0 ? `Cargar más leads de esta etapa (quedan ${remainingStageLeads})` : 'No hay más leads que cargar'}
                        className="text-xs h-7 px-2"
                      >
                        Cargar + ({stageLeads.length})
                      </Button>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        Quedan {remainingStageLeads}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col gap-3 md:gap-2 overflow-x-auto md:overflow-x-hidden md:overflow-y-auto min-h-[120px] md:min-h-[200px] bg-muted/30 rounded-lg p-2 md:flex-1 no-scrollbar-mobile pb-4 md:pb-2">
                    {stageLeads.map(lead => (
                      <Card
                        key={lead.id}
                        id={`lead-card-${lead.id}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead)}
                        className={cn(
                          "w-[85vw] sm:w-80 md:w-full shrink-0 p-2 cursor-move hover:shadow-md transition-all border-l-4 active:opacity-50",
                          highlightedLeadId === lead.id && "ring-2 ring-primary ring-offset-2 animate-pulse"
                        )}
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
                              {isMobile ? (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setMoveDialogLead(lead)
                                    setMoveDialogOpen(true)
                                  }}
                                >
                                  Mover a Etapa
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger disabled={!isAdminOrOwner}>Mover a Etapa</DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent>
                                    {(currentPipeline?.stages || []).map(s => (
                                      <DropdownMenuItem
                                        key={s.id}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleMoveLead(lead, s.id)
                                        }}
                                        disabled={s.id === lead.stage}
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                          {s.name}
                                        </div>
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>
                              )}
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
                          {notasCounts[lead.id] > 0 && (
                            <TooltipProvider delayDuration={300}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-0.5 ml-1 text-amber-600">
                                    <Note size={12} weight="fill" />
                                    <span className="text-[10px] font-medium">{notasCounts[lead.id]}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  {notasCounts[lead.id]} nota{notasCounts[lead.id] > 1 ? 's' : ''}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
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
                              className="text-xs h-4 px-1 max-w-20 truncate"
                              style={{ borderColor: tag.color, color: tag.color }}
                              title={tag.name}
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
          onDeleteLead={handleDeleteLead}
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
