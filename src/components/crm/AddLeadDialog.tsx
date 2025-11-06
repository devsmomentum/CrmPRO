import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus } from '@phosphor-icons/react'
import { Lead, PipelineType, Stage } from '@/lib/types'
import { toast } from 'sonner'

interface AddLeadDialogProps {
  pipelineType: PipelineType
  stages: Stage[]
  teamMembers: string[]
  onAdd: (lead: Lead) => void
  trigger?: React.ReactNode
}

export function AddLeadDialog({ pipelineType, stages, teamMembers, onAdd, trigger }: AddLeadDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [budget, setBudget] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [assignedTo, setAssignedTo] = useState(teamMembers[0] || 'Unassigned')

  const handleSubmit = () => {
    if (!name.trim() || !email.trim() || !phone.trim()) {
      toast.error('Please fill in all required fields')
      return
    }

    const newLead: Lead = {
      id: Date.now().toString(),
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      company: company.trim(),
      pipeline: pipelineType,
      stage: stages[0]?.id || '',
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
    toast.success('Lead added!')
  }

  const resetForm = () => {
    setName('')
    setEmail('')
    setPhone('')
    setCompany('')
    setBudget('')
    setPriority('medium')
    setAssignedTo(teamMembers[0] || 'Unassigned')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="mr-2" size={20} />
            New Lead
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="lead-name">Full Name *</Label>
            <Input
              id="lead-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Smith"
            />
          </div>
          <div>
            <Label htmlFor="lead-email">Email *</Label>
            <Input
              id="lead-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@company.com"
            />
          </div>
          <div>
            <Label htmlFor="lead-phone">Phone *</Label>
            <Input
              id="lead-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
            />
          </div>
          <div>
            <Label htmlFor="lead-company">Company</Label>
            <Input
              id="lead-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Acme Corp"
            />
          </div>
          <div>
            <Label htmlFor="lead-budget">Budget</Label>
            <Input
              id="lead-budget"
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="10000"
            />
          </div>
          <div>
            <Label htmlFor="lead-priority">Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
              <SelectTrigger id="lead-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="lead-assigned">Assign To</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger id="lead-assigned">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.length === 0 ? (
                  <SelectItem value="Unassigned">Unassigned</SelectItem>
                ) : (
                  teamMembers.map(member => (
                    <SelectItem key={member} value={member}>{member}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSubmit} className="w-full">Add Lead</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
