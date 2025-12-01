import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus } from '@phosphor-icons/react'
import { Lead, PipelineType, Stage } from '@/lib/types'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'
import { Company } from './CompanyManagement'

interface AddLeadDialogProps {
  pipelineType: PipelineType
  stages: Stage[]
  teamMembers: string[]
  onAdd: (lead: Lead) => void
  trigger?: React.ReactNode
  defaultStageId?: string
  companies?: Company[]
}

export function AddLeadDialog({ pipelineType, stages, teamMembers, onAdd, trigger, defaultStageId, companies = [] }: AddLeadDialogProps) {
  const t = useTranslation('es')
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [budget, setBudget] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [assignedTo, setAssignedTo] = useState(teamMembers[0] || 'Sin asignar')
  const firstStageId = stages[0]?.id || ''
  const [stageId, setStageId] = useState(defaultStageId || firstStageId)

  useEffect(() => {
    setStageId(defaultStageId || firstStageId)
  }, [defaultStageId, firstStageId])

  const handleSubmit = () => {
    if (!name.trim() || !email.trim() || !phone.trim()) {
      toast.error(t.messages.fillRequired)
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
    setAssignedTo(teamMembers[0] || 'Sin asignar')
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
            <Label htmlFor="lead-email">{t.lead.email} *</Label>
            <Input
              id="lead-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="juan@empresa.com"
            />
          </div>
          <div>
            <Label htmlFor="lead-phone">{t.lead.phone} *</Label>
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
            {companies.length > 0 ? (
              <Select value={company} onValueChange={setCompany}>
                <SelectTrigger id="lead-company">
                  <SelectValue placeholder="Seleccionar empresa" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="lead-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Corp"
              />
            )}
          </div>
          <div>
            <Label htmlFor="lead-budget">{t.lead.budget}</Label>
            <Input
              id="lead-budget"
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
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
            <Label htmlFor="lead-assigned">{t.lead.assignTo}</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger id="lead-assigned">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.length === 0 ? (
                  <SelectItem value="Sin asignar">Sin asignar</SelectItem>
                ) : (
                  teamMembers.map(member => (
                    <SelectItem key={member} value={member}>{member}</SelectItem>
                  ))
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
