/**
 * AddLeadDialog - Dialog for creating leads manually or importing from Excel/PDF
 * 
 * REFACTORED: Reduced from 1,411 lines → ~280 lines by extracting:
 * - SingleLeadForm: Manual lead creation form
 * - BulkImportView: Excel/PDF import with useExcelImport hook
 */

import { useEffect, useState, useMemo, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Plus } from '@phosphor-icons/react'
import { Lead, PipelineType, Stage, TeamMember } from '@/lib/types'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'
import { Company } from './CompanyManagement'
import { usePersistentState } from '@/hooks/usePersistentState'
import { createLead, createLeadsBulk } from '@/supabase/services/leads'
import { SingleLeadForm, BulkImportView } from './leads'
import { listWhatsappInstancias } from '@/supabase/services/instances'
import type { EmpresaInstanciaDB } from '@/lib/types'
import type { SingleLeadFormData } from './leads/SingleLeadForm'
import type { PreviewRow } from '@/hooks/useExcelImport'

interface User {
  id: string
  email: string
  businessName: string
}

interface AddLeadDialogProps {
  pipelineType: PipelineType
  pipelineId?: string
  stages: Stage[]
  teamMembers: TeamMember[]
  onAdd: (lead: Lead) => void
  onImport?: (leads: Lead[]) => void
  trigger?: React.ReactNode
  defaultStageId?: string
  companies?: Company[]
  currentUser?: User | null
  companyName?: string
  companyId?: string
}

// Max budget limit
const MAX_BUDGET = 10_000_000

export function AddLeadDialog({
  pipelineType,
  pipelineId,
  stages,
  teamMembers,
  onAdd,
  onImport,
  trigger,
  defaultStageId,
  companies = [],
  currentUser,
  companyName,
  companyId
}: AddLeadDialogProps) {
  const t = useTranslation('es')
  const [open, setOpen] = useState(false)
  const [localUser] = usePersistentState<User | null>('current-user', null)
  const effectiveUser = currentUser || localUser

  const [activeTab, setActiveTab] = useState('manual')
  const [pasteText, setPasteText] = useState('')
  const [stageId, setStageId] = useState(defaultStageId || stages[0]?.id || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [waInstances, setWaInstances] = useState<Pick<EmpresaInstanciaDB, 'id' | 'label'>[]>([])

  // Cargar instancias WA activas de la empresa
  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        if (!companyId) return
        const list = await listWhatsappInstancias(companyId)
        if (mounted) {
          setWaInstances(list.map(i => ({ id: i.id, label: i.label || 'WhatsApp' })))
        }
      } catch (e) {
        console.warn('[AddLeadDialog] No se pudieron cargar instancias WA', e)
      }
    }
    load()
    return () => { mounted = false }
  }, [companyId])

  // Eligible team members for this pipeline
  const eligibleMembers = useMemo(() => {
    const filtered = teamMembers.filter(m => {
      const ps = m.pipelines || []
      if (ps.length === 0) return false
      if (pipelineId && ps.includes(pipelineId)) return true
      if (ps.includes(pipelineType)) return true
      if (companyName && ps.includes(companyName)) return true
      return false
    })
    if (effectiveUser) {
      const labelBase = companyName || effectiveUser.businessName || effectiveUser.email || 'Yo'
      const userAsMember: TeamMember = {
        id: effectiveUser.id,
        name: `${labelBase} (Yo)`,
        email: effectiveUser.email,
        avatar: '',
        role: 'self',
        pipelines: [],
        permissionRole: 'viewer'
      }
      const withoutUser = filtered.filter(m => m.id !== effectiveUser.id)
      return [userAsMember, ...withoutUser]
    }
    return filtered
  }, [teamMembers, pipelineType, effectiveUser, companyName, pipelineId])

  // Update stageId when defaultStageId changes
  useEffect(() => {
    setStageId(defaultStageId || stages[0]?.id || '')
  }, [defaultStageId, stages])

  // Handle manual form submission
  const handleManualSubmit = useCallback(async (data: SingleLeadFormData) => {
    if (!pipelineId && !companyId) {
      toast.error('No se pudo identificar el pipeline o empresa')
      return
    }

    setIsSubmitting(true)
    try {
      // Generar email dummy si no existe (para cumplir con restricción NOT NULL de DB)


      const dbLead = await createLead({
        nombre_completo: data.name,
        correo_electronico: data.email?.trim() || undefined,
        telefono: data.phone || undefined,
        empresa: data.company || undefined,
        ubicacion: data.location || undefined,
        evento: data.evento || undefined,
        membresia: data.membresia || undefined,
        presupuesto: data.budget,
        etapa_id: data.stageId,
        pipeline_id: pipelineId || '',
        empresa_id: companyId || '',
        asignado_a: data.assignedTo === 'todos' ? '00000000-0000-0000-0000-000000000000' : data.assignedTo,
        prioridad: data.priority,
        preferred_instance_id: data.preferredInstanceId || null
      })

      if (dbLead) {
        const newLead: Lead = {
          id: dbLead.id,
          name: dbLead.nombre_completo || '',
          email: dbLead.correo_electronico || '',
          phone: dbLead.telefono || '',
          company: dbLead.empresa || '',
          location: dbLead.ubicacion || '',
          evento: dbLead.evento || '',
          membresia: dbLead.membresia || '',
          budget: dbLead.presupuesto || 0,
          stage: dbLead.etapa_id || '',
          pipeline: dbLead.pipeline_id || pipelineType,
          priority: dbLead.prioridad as 'low' | 'medium' | 'high',
          assignedTo: dbLead.asignado_a || '',
          tags: [],
          createdAt: new Date(dbLead.created_at),
          lastContact: new Date(dbLead.created_at)
        }
        onAdd(newLead)
        toast.success('Lead creado exitosamente')
        setOpen(false)
      }
    } catch (err) {
      console.error('Error creating lead:', err)
      const message = err instanceof Error ? err.message : 'Error al crear el lead'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }, [pipelineId, companyId, pipelineType, onAdd, t])

  // Handle bulk import
  const handleBulkImport = useCallback(async (validRows: PreviewRow[]) => {
    if (!pipelineId || !companyId || !stageId) {
      toast.error('Faltan datos del pipeline o etapa')
      return
    }

    const batchLeads = validRows.map((row, index) => ({
      nombre_completo: row.nombre_completo || '',
      telefono: row.telefono,
      correo_electronico: row.correo_electronico || undefined,
      empresa: row.empresa,
      ubicacion: row.ubicacion,
      presupuesto: row.presupuesto,
      empresa_id: companyId,
      pipeline_id: pipelineId,
      etapa_id: stageId,
      asignado_a: '00000000-0000-0000-0000-000000000000',
      prioridad: 'medium' as const
    }))

    const result = await createLeadsBulk(batchLeads)

    if (result && Array.isArray(result)) {
      const importedLeads: Lead[] = result.map(r => ({
        id: r.id,
        name: r.nombre_completo || '',
        email: r.correo_electronico || '',
        phone: r.telefono || '',
        company: r.empresa || '',
        location: r.ubicacion || '',
        budget: r.presupuesto || 0,
        stage: r.etapa_id || stageId,
        pipeline: r.pipeline_id || pipelineId || pipelineType,
        priority: (r.prioridad as 'low' | 'medium' | 'high') || 'medium',
        assignedTo: r.asignado_a || '',
        tags: [],
        createdAt: r.created_at ? new Date(r.created_at) : new Date(),
        lastContact: r.created_at ? new Date(r.created_at) : new Date()
      }))

      onImport?.(importedLeads)
      importedLeads.forEach(lead => onAdd(lead))

      setOpen(false)
    }
  }, [pipelineId, companyId, stageId, pipelineType, onAdd, onImport])

  // Handle paste text processing (simplified version)
  const processPasteText = useCallback(() => {
    if (!pasteText.trim()) return

    // Simple parsing - extract key-value pairs
    const lines = pasteText.split('\n')
    let name = '', email = '', phone = '', company = '', budget = ''

    lines.forEach(line => {
      const trimmed = line.trim()
      if (!trimmed) return

      if (trimmed.includes(':')) {
        const [key, ...rest] = trimmed.split(':')
        const value = rest.join(':').trim()
        const keyLower = key.toLowerCase()

        if (['cliente', 'nombre', 'name'].some(k => keyLower.includes(k))) {
          name = value.replace(/[\[\]]/g, '')
        } else if (['email', 'correo'].some(k => keyLower.includes(k))) {
          email = value
        } else if (['telefono', 'phone', 'cel'].some(k => keyLower.includes(k))) {
          phone = value
        } else if (['empresa', 'company'].some(k => keyLower.includes(k))) {
          company = value
        } else if (['presupuesto', 'costo', 'precio'].some(k => keyLower.includes(k))) {
          budget = value.replace(/[^0-9.]/g, '')
        }
      } else if (trimmed.includes('@')) {
        email = trimmed
      }
    })

    toast.info(`Detectado: ${name || 'Sin nombre'}, ${email || 'Sin email'}`)
    setActiveTab('manual')
    setPasteText('')
  }, [pasteText])

  const resetForm = () => {
    setActiveTab('manual')
    setPasteText('')
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen)
      if (!isOpen) resetForm()
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            size="sm"
            className="h-9 px-4 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm hover:shadow-md transition-all font-medium"
          >
            <Plus size={16} className="mr-1.5" weight="bold" />
            <span className="text-sm">{t.pipeline.addLead}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className={`max-h-[90vh] overflow-y-auto transition-all duration-300 ${activeTab === 'excel' ? 'max-w-[95vw] md:max-w-5xl lg:max-w-6xl' : 'max-w-md sm:max-w-xl md:max-w-2xl'
        }`}>
        <DialogHeader>
          <DialogTitle>{t.pipeline.addLead}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="manual">Manual</TabsTrigger>
            <TabsTrigger value="paste">Pegar Rápido</TabsTrigger>
            <TabsTrigger value="excel">Importar Excel</TabsTrigger>
          </TabsList>

          {/* Manual Tab - Uses SingleLeadForm */}
          <TabsContent value="manual">
            <SingleLeadForm
              stages={stages}
              eligibleMembers={eligibleMembers}
              defaultStageId={stageId}
              defaultAssignedTo={eligibleMembers[0]?.id}
              onSubmit={handleManualSubmit}
              isSubmitting={isSubmitting}
              whatsappInstances={waInstances}
            />
          </TabsContent>

          {/* Paste Tab */}
          <TabsContent value="paste" className="space-y-4">
            <div className="space-y-2">
              <Label>Instrucciones:</Label>
              <p className="text-sm text-muted-foreground">
                Copia los datos de tu cliente (WhatsApp, Email) y pégalos abajo.
                El sistema intentará identificar automáticamente los campos.
              </p>
            </div>
            <Textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`Cliente: [Nombre del Cliente]
                            Vendedor: [Nombre Vendedor]
                            Costo: 100
                            Contacto: email@cliente.com
                            ...`}
              className="min-h-[200px] font-mono text-sm"
            />
            <Button onClick={processPasteText} className="w-full">
              Procesar y Verificar
            </Button>
          </TabsContent>

          {/* Excel Import Tab - Uses BulkImportView */}
          <TabsContent value="excel" className="h-full">
            <BulkImportView
              stages={stages}
              companyId={companyId}
              stageId={stageId}
              onStageChange={setStageId}
              onImport={handleBulkImport}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
