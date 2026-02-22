import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { TeamMember, Lead } from '@/lib/types'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { X, Calendar as CalendarIcon } from '@phosphor-icons/react'
import { createLeadMeeting } from '@/supabase/services/reuniones'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format } from 'date-fns'

export interface AddMeetingFormData {
  title: string
  date: string
  duration: number
  participants: string[]
  notes: string
  leadId?: string
}

interface AddMeetingDialogProps {
  leadId?: string
  leads?: Lead[]
  empresaId: string
  open: boolean
  onClose: () => void
  onAdd?: (meeting: AddMeetingFormData) => Promise<void> | void
  teamMembers?: TeamMember[]
  defaultDate?: Date
}

export function AddMeetingDialog(props: AddMeetingDialogProps) {
  const t = useTranslation('es')
  const { open, onClose, leadId: initialLeadId, leads, empresaId, onAdd, teamMembers = [], defaultDate } = props

  const [selectedLeadId, setSelectedLeadId] = useState<string>(initialLeadId || '')
  
  useEffect(() => {
    if (initialLeadId) {
      setSelectedLeadId(initialLeadId)
    }
  }, [initialLeadId])

  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  
  useEffect(() => {
      if (open && defaultDate) {
          // Format for input type="datetime-local": YYYY-MM-DDThh:mm
          const d = new Date(defaultDate)
          const offset = d.getTimezoneOffset()
          const adjusted = new Date(d.getTime() - (offset * 60 * 1000))
          setDate(adjusted.toISOString().slice(0, 16))
      }
  }, [open, defaultDate])

  const [duration, setDuration] = useState(30)
  const [notes, setNotes] = useState('')
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([])
  const [participantInput, setParticipantInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAddParticipant = () => {
    if (participantInput.trim() && !selectedParticipants.includes(participantInput.trim())) {
      setSelectedParticipants([...selectedParticipants, participantInput.trim()])
      setParticipantInput('')
    }
  }

  const handleRemoveParticipant = (participant: string) => {
    setSelectedParticipants(selectedParticipants.filter(p => p !== participant))
  }

  const handleSubmit = async () => {
    if (!selectedLeadId) {
        toast.error('Debe seleccionar un lead')
        return
    }

    if (!title.trim() || !date) {
      toast.error(t.messages.fillRequired)
      return
    }

    setIsSubmitting(true)
    try {
      // Use createLeadMeeting from reuniones.ts (writes to lead_reuniones table)
      await createLeadMeeting({
        leadId: selectedLeadId,
        empresaId,
        title: title.trim(),
        date: new Date(date),
        duration,
        participants: selectedParticipants,
        notes: notes.trim()
      })

      // Llamar callback opcional si existe (para compatibilidad)
      if (onAdd) {
        await onAdd({
          title: title.trim(),
          date,
          duration,
          participants: selectedParticipants,
          notes: notes.trim(),
          leadId: selectedLeadId
        })
      }

      toast.success(t.messages.meetingCreated)
      resetForm()
      onClose()
    } catch (error: any) {
      console.error('Error creating meeting:', error)
      const msg = error?.message || error?.details || 'Error desconocido'
      toast.error(`No se pudo crear la reunión: ${msg}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setTitle('')
    setDate('')
    setDuration(30)
    setNotes('')
    setSelectedParticipants([])
    setParticipantInput('')
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.meeting.addMeeting}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!initialLeadId && leads && leads.length > 0 && (
            <div>
              <Label>Lead *</Label>
              <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar Lead" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {leads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.nombre || lead.name || 'Sin nombre'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="meeting-title">{t.meeting.meetingTitle}</Label>
            <Input
              id="meeting-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Reunión de seguimiento"
            />
          </div>
          <div>
            <Label htmlFor="meeting-date">{t.meeting.date}</Label>
            <Input
              id="meeting-date"
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="meeting-duration">{t.meeting.duration}</Label>
            <Input
              id="meeting-duration"
              type="number"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
            />
          </div>
          <div>
            <Label>{t.meeting.participants}</Label>
            <div className="flex gap-2 mb-2">
              <Input
                value={participantInput}
                onChange={(e) => setParticipantInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddParticipant())}
                placeholder="Nombre del participante"
              />
              <Button onClick={handleAddParticipant} type="button" size="sm">
                {t.buttons.add}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {(teamMembers || []).filter(m => !selectedParticipants.includes(m.name)).map(member => (
                <Badge
                  key={member.id}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                  onClick={() => setSelectedParticipants([...selectedParticipants, member.name])}
                >
                  {member.name}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedParticipants.map(participant => (
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
            <Label htmlFor="meeting-notes">{t.meeting.notes}</Label>
            <Textarea
              id="meeting-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas de la reunión..."
              rows={4}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSubmit} className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando…' : t.meeting.save}
            </Button>
            <Button onClick={onClose} variant="outline" disabled={isSubmitting}>{t.buttons.cancel}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
