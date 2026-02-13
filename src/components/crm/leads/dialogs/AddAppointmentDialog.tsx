import { useState, useEffect } from 'react'
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
  defaultDate?: Date
}

export function AddAppointmentDialog({ open, onClose, onAdd, leads, defaultDate }: AddAppointmentDialogProps) {
  const t = useTranslation('es')

  const [leadId, setLeadId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  
  // Initialize with defaultDate if provided
  const getInitialTime = (date?: Date, addHours = 0) => {
    if (!date) return ''
    const d = new Date(date)
    d.setHours(d.getHours() + addHours)
    // Adjust for timezone offset to keep local time in ISO string
    const offset = d.getTimezoneOffset()
    const adjusted = new Date(d.getTime() - (offset * 60 * 1000))
    return adjusted.toISOString().slice(0, 16)
  }

  const [startTime, setStartTime] = useState(getInitialTime(defaultDate || new Date()))
  const [endTime, setEndTime] = useState(getInitialTime(defaultDate || new Date(), 1))

  // Update effect when dialog opens
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const [prevOpen, setPrevOpen] = useState(false)
  if (open && !prevOpen) {
      if (defaultDate) {
          // Calculate dates only when opening to avoid constant re-renders or stale dates
          const start = getInitialTime(defaultDate)
          const end = getInitialTime(defaultDate, 1)
          // We can't set state directly in render, use effect
      }
  }
  
  // Better approach: use useEffect
  useEffect(() => {
    if (open && defaultDate) {
       setStartTime(getInitialTime(defaultDate))
       setEndTime(getInitialTime(defaultDate, 1))
    } else if (open && !startTime) {
       // If no default date but opening, ensure we have "now"
       const now = new Date()
       setStartTime(getInitialTime(now))
       setEndTime(getInitialTime(now, 1))
    }
  }, [open, defaultDate])
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
