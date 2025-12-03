import { useEffect, useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus } from '@phosphor-icons/react'
import { Lead, PipelineType, Stage, TeamMember } from '@/lib/types'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'
import { Company } from './CompanyManagement'
import { usePersistentState } from '@/hooks/usePersistentState'

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
  trigger?: React.ReactNode
  defaultStageId?: string
  companies?: Company[]
  currentUser?: User | null
  companyName?: string // nombre de la empresa activa
}

export function AddLeadDialog({ pipelineType, pipelineId, stages, teamMembers, onAdd, trigger, defaultStageId, companies = [], currentUser, companyName }: AddLeadDialogProps) {
  const t = useTranslation('es')
  const [open, setOpen] = useState(false)
  const [localUser] = usePersistentState<User | null>('current-user', null)
  
  // Priorizar currentUser prop, luego localUser.
  // Si no hay usuario, usar un objeto dummy (aunque idealmente siempre debería haber usuario)
  const effectiveUser = currentUser || localUser
  
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [budget, setBudget] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  
  // Usar ID para assignedTo
  const [assignedTo, setAssignedTo] = useState(teamMembers[0]?.id || effectiveUser?.id || '')
  
  const firstStageId = stages[0]?.id || ''
  const [stageId, setStageId] = useState(defaultStageId || firstStageId)

  // Miembros elegibles: aquellos cuyo array pipelines incluye el pipeline actual (o no tienen restricción)
  // Siempre incluir "Yo" (effectiveUser) como primera opción, evitando duplicados.
  const eligibleMembers = useMemo(() => {
    const filtered = teamMembers.filter(m => {
      const ps = m.pipelines || []
      if (ps.length === 0) return false
      // Coincidencia por ID de pipeline, por slug/type o por nombre
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
  }, [teamMembers, pipelineType, effectiveUser, companyName])

  useEffect(() => {
    setStageId(defaultStageId || firstStageId)
  }, [defaultStageId, firstStageId])

  useEffect(() => {
    if (open) {
      // Si no hay asignado, intentar poner al effectiveUser (ID) o el primer miembro (ID)
      if (!assignedTo) {
        setAssignedTo(teamMembers[0]?.id || effectiveUser?.id || '')
      }
    }
  }, [open, teamMembers, effectiveUser])

  // Asegurar que el asignado actual pertenece a la lista elegible; si no, reasignar.
  useEffect(() => {
    if (eligibleMembers.length && !eligibleMembers.find(m => m.id === assignedTo)) {
      setAssignedTo(eligibleMembers[0].id)
    }
  }, [eligibleMembers, assignedTo])

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error(t.messages.fillRequired)
      return
    }

    if (!assignedTo || assignedTo === 'Sin asignar') {
      toast.error('Debes asignar el lead a un miembro del equipo')
      return
    }

    if (!stageId) {
      toast.error(t.pipeline.noStages)
      return
    }

    const newLead: Lead = {
      id: Date.now().toString(),
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      company: company.trim(),
      pipeline: pipelineType,
      stage: stageId,
      tags: [],
      priority,
      budget: budget ? parseFloat(budget) : 0,
      assignedTo,
      createdAt: new Date(),
      lastContact: new Date()
    }

    onAdd(newLead)
    resetForm()
    setOpen(false)
    toast.success(t.messages.leadAdded)
  }

  const resetForm = () => {
    setName('')
    setEmail('')
    setPhone('')
    setCompany('')
    setBudget('')
    setPriority('medium')
    setAssignedTo(teamMembers[0]?.id || effectiveUser?.id || '')
    setStageId(defaultStageId || firstStageId)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="mr-2" size={20} />
            {t.pipeline.addLead}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.pipeline.addLead}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="lead-name">{t.lead.name} *</Label>
            <Input
              id="lead-name"
              value={name}
              onChange={(e) => {
                if (e.target.value.length <= 30) setName(e.target.value)
              }}
              placeholder="Nombre del Lead"
            />
          </div>
          <div>
            <Label htmlFor="lead-email">{t.lead.email}</Label>
            <Input
              id="lead-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="juan@empresa.com"
            />
          </div>
          <div>
            <Label htmlFor="lead-phone">{t.lead.phone}</Label>
            <Input
              id="lead-phone"
              value={phone}
              onChange={(e) => {
                const val = e.target.value
                if (val.length <= 15 && !/[a-zA-Z]/.test(val)) {
                  setPhone(val)
                }
              }}
              placeholder="+1 (555) 000-0000"
            />
          </div>
          <div>
            <Label htmlFor="lead-company">{t.lead.company}</Label>
            <Input
              id="lead-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Nombre de la empresa"
            />
          </div>
          <div>
            <Label htmlFor="lead-budget">{t.lead.budget}</Label>
            <Input
              id="lead-budget"
              type="number"
              min="0"
              value={budget}
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                if (val < 0) return
                setBudget(e.target.value)
              }}
              placeholder="10000"
            />
          </div>
          {stages.length > 0 && (
            <div>
              <Label htmlFor="lead-stage">{t.stage.name}</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger id="lead-stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map(stage => (
                    <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="lead-priority">{t.lead.priority}</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
              <SelectTrigger id="lead-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">{t.lead.lowPriority}</SelectItem>
                <SelectItem value="medium">{t.lead.mediumPriority}</SelectItem>
                <SelectItem value="high">{t.lead.highPriority}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="lead-assigned">{t.lead.assignTo} *</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger id="lead-assigned">
                <SelectValue placeholder="Seleccionar miembro" />
              </SelectTrigger>
              <SelectContent>
                {eligibleMembers.map(member => (
                  <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                ))}
                {eligibleMembers.length === 0 && (
                  <SelectItem value="none" disabled>Sin miembros disponibles</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSubmit} className="w-full">{t.buttons.add}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
