import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Appointment, Lead, TeamMember } from '@/lib/types'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'
import { useKV } from '@github/spark/hooks'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface AddAppointmentDialogProps {
  open: boolean
  onClose: () => void
  onAdd: (appointment: Appointment) => void
}

export function AddAppointmentDialog({ open, onClose, onAdd }: AddAppointmentDialogProps) {
  const t = useTranslation('es')
  const [leads] = useKV<Lead[]>('leads', [])
  const [teamMembers] = useKV<TeamMember[]>('team-members', [])
  
  const [leadId, setLeadId] = useState('')
  const [teamMemberId, setTeamMemberId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')

  const handleSubmit = () => {
    if (!leadId || !title.trim() || !startTime || !endTime) {
      toast.error('Completa todos los campos requeridos')
      return
    }

    const start = new Date(startTime)
    const end = new Date(endTime)

    if (end <= start) {
      toast.error('La hora de fin debe ser posterior a la hora de inicio')
      return
    }

    const newAppointment: Appointment = {
      id: Date.now().toString(),
      leadId,
      teamMemberId: teamMemberId || 'default',
      title: title.trim(),
      description: description.trim(),
      startTime: start,
      endTime: end,
      status: 'scheduled'
    }

    onAdd(newAppointment)
    resetForm()
    onClose()
    toast.success('Cita creada exitosamente')
  }

  const resetForm = () => {
    setLeadId('')
    setTeamMemberId('')
    setTitle('')
    setDescription('')
    setStartTime('')
    setEndTime('')
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Cita</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="appointment-lead">Lead *</Label>
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger id="appointment-lead">
                <SelectValue placeholder="Selecciona un lead" />
              </SelectTrigger>
              <SelectContent>
                {(leads || []).map(lead => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.name} - {lead.company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="appointment-team">Asignado a</Label>
            <Select value={teamMemberId} onValueChange={setTeamMemberId}>
              <SelectTrigger id="appointment-team">
                <SelectValue placeholder="Selecciona un miembro" />
              </SelectTrigger>
              <SelectContent>
                {(teamMembers || []).map(member => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name} - {member.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="appointment-title">Título *</Label>
            <Input
              id="appointment-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Reunión de seguimiento"
            />
          </div>

          <div>
            <Label htmlFor="appointment-description">Descripción</Label>
            <Textarea
              id="appointment-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles de la cita..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="appointment-start">Hora de Inicio *</Label>
            <Input
              id="appointment-start"
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="appointment-end">Hora de Fin *</Label>
            <Input
              id="appointment-end"
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSubmit} className="flex-1">Crear Cita</Button>
            <Button onClick={onClose} variant="outline">Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
