import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Lead } from '@/lib/types'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CreateAppointmentDTO } from '@/supabase/services/appointments'
import { Badge } from '@/components/ui/badge'
import { X } from '@phosphor-icons/react'

interface AddAppointmentDialogProps {
  open: boolean
  onClose: () => void
  onAdd: (appointment: CreateAppointmentDTO) => Promise<void>
  leads: Lead[]
}

export function AddAppointmentDialog({ open, onClose, onAdd, leads }: AddAppointmentDialogProps) {
  const t = useTranslation('es')

  const [leadId, setLeadId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [participants, setParticipants] = useState<string[]>([])
  const [participantInput, setParticipantInput] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
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

    setIsSubmitting(true)
    try {
      await onAdd({
        lead_id: leadId,
        title: title.trim(),
        description: description.trim(),
        start_time: start,
        end_time: end,
        status: 'scheduled',
        participants,
        notes: notes.trim(),
        empresa_id: '' // Parent will override this
      })
      resetForm()
      onClose()
    } catch (e) {
      // Error handled in parent/hook usually
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setLeadId('')
    setTitle('')
    setDescription('')
    setStartTime('')
    setEndTime('')
    setParticipants([])
    setParticipantInput('')
    setNotes('')
  }

  const handleAddParticipant = () => {
    if (participantInput.trim() && !participants.includes(participantInput.trim())) {
      setParticipants([...participants, participantInput.trim()])
      setParticipantInput('')
    }
  }

  const handleRemoveParticipant = (participant: string) => {
    setParticipants(participants.filter(p => p !== participant))
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

          <div>
            <Label>Participantes</Label>
            <div className="flex gap-2 mb-2">
              <Input
                value={participantInput}
                onChange={(e) => setParticipantInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddParticipant())}
                placeholder="Nombre del participante"
              />
              <Button onClick={handleAddParticipant} type="button" size="sm">
                Añadir
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {participants.map(participant => (
                <Badge key={participant} className="gap-1">
                  {participant}
                  <button onClick={() => handleRemoveParticipant(participant)}>
                    <X size={12} />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="appointment-notes">Notas</Label>
            <Textarea
              id="appointment-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales de la reunión..."
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSubmit} className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? 'Creando...' : 'Crear Cita'}
            </Button>
            <Button onClick={onClose} variant="outline" disabled={isSubmitting}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
