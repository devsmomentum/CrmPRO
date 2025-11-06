import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Meeting, TeamMember } from '@/lib/types'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'
import { useKV } from '@github/spark/hooks'
import { Badge } from '@/components/ui/badge'
import { X } from '@phosphor-icons/react'

interface AddMeetingDialogProps {
  leadId: string
  open: boolean
  onClose: () => void
  onAdd: (meeting: Meeting) => void
}

export function AddMeetingDialog({ leadId, open, onClose, onAdd }: AddMeetingDialogProps) {
  const t = useTranslation('es')
  const [teamMembers] = useKV<TeamMember[]>('team-members', [])
  
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [duration, setDuration] = useState(30)
  const [notes, setNotes] = useState('')
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([])
  const [participantInput, setParticipantInput] = useState('')

  const handleAddParticipant = () => {
    if (participantInput.trim() && !selectedParticipants.includes(participantInput.trim())) {
      setSelectedParticipants([...selectedParticipants, participantInput.trim()])
      setParticipantInput('')
    }
  }

  const handleRemoveParticipant = (participant: string) => {
    setSelectedParticipants(selectedParticipants.filter(p => p !== participant))
  }

  const handleSubmit = () => {
    if (!title.trim() || !date) {
      toast.error(t.messages.fillRequired)
      return
    }

    const newMeeting: Meeting = {
      id: Date.now().toString(),
      leadId,
      title: title.trim(),
      date: new Date(date),
      duration,
      participants: selectedParticipants,
      notes: notes.trim(),
      createdAt: new Date()
    }

    onAdd(newMeeting)
    resetForm()
    onClose()
    toast.success(t.messages.meetingCreated)
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
            <Button onClick={handleSubmit} className="flex-1">{t.meeting.save}</Button>
            <Button onClick={onClose} variant="outline">{t.buttons.cancel}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
