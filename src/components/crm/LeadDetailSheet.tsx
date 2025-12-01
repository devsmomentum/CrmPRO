import { useState } from 'react'
import { Lead, Message, Note, Budget, Meeting, Channel, Tag, TeamMember } from '@/lib/types'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useKV } from '@github/spark/hooks'
import { 
  PaperPlaneRight, 
  Tag as TagIcon, 
  Note as NoteIcon, 
  CurrencyDollar,
  CalendarBlank,
  WhatsappLogo,
  InstagramLogo,
  FacebookLogo,
  EnvelopeSimple,
  Phone,
  X,
  Plus,
  PencilSimple
} from '@phosphor-icons/react'
import { format } from 'date-fns'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AddBudgetDialog } from './AddBudgetDialog'
import { AddMeetingDialog } from './AddMeetingDialog'
import { EditBudgetDialog } from './EditBudgetDialog'
import { InlineEdit } from './InlineEdit'
import { useTranslation } from '@/lib/i18n'

interface LeadDetailSheetProps {
  lead: Lead
  open: boolean
  onClose: () => void
  onUpdate: (lead: Lead) => void
  teamMembers?: TeamMember[]
  canEdit?: boolean
}

export function LeadDetailSheet({ lead, open, onClose, onUpdate, teamMembers = [], canEdit = true }: LeadDetailSheetProps) {
  const t = useTranslation('es')
  const [messages, setMessages] = useKV<Message[]>('messages', [])
  const [notes, setNotes] = useKV<Note[]>('notes', [])
  const [budgets, setBudgets] = useKV<Budget[]>('budgets', [])
  const [meetings, setMeetings] = useKV<Meeting[]>('meetings', [])
  const [allTags, setAllTags] = useKV<Tag[]>('all-tags', [])
  
  const [activeTab, setActiveTab] = useState('overview')
  const [messageInput, setMessageInput] = useState('')
  const [selectedChannel, setSelectedChannel] = useState<Channel>('whatsapp')
  const [noteInput, setNoteInput] = useState('')
  const [showTagDialog, setShowTagDialog] = useState(false)
  const [showBudgetDialog, setShowBudgetDialog] = useState(false)
  const [showMeetingDialog, setShowMeetingDialog] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#3b82f6')

  const leadMessages = (messages || []).filter(m => m.leadId === lead.id)
  const leadNotes = (notes || []).filter(n => n.leadId === lead.id)
  const leadBudgets = (budgets || []).filter(b => b.leadId === lead.id)
  const leadMeetings = (meetings || []).filter(m => m.leadId === lead.id)

  const channelIcons = {
    whatsapp: WhatsappLogo,
    instagram: InstagramLogo,
    facebook: FacebookLogo,
    email: EnvelopeSimple,
    phone: Phone
  } as const
  
  const getChannelIcon = (channel: Channel) => {
    return channelIcons[channel] || EnvelopeSimple
  }

  const sendMessage = () => {
    if (!messageInput.trim()) return

    const newMessage: Message = {
      id: Date.now().toString(),
      leadId: lead.id,
      channel: selectedChannel,
      content: messageInput,
      timestamp: new Date(),
      sender: 'team',
      read: true
    }

    setMessages((current) => [...(current || []), newMessage])
    setMessageInput('')
    toast.success(t.messages.messageSent)
  }

  const addNote = () => {
    if (!noteInput.trim()) return

    const newNote: Note = {
      id: Date.now().toString(),
      leadId: lead.id,
      content: noteInput,
      createdBy: 'Current User',
      createdAt: new Date()
    }

    setNotes((current) => [...(current || []), newNote])
    setNoteInput('')
    toast.success(t.messages.noteAdded)
  }

  const addNewTag = () => {
    if (!newTagName.trim()) return

    const newTag: Tag = {
      id: Date.now().toString(),
      name: newTagName,
      color: newTagColor
    }

    setAllTags((current) => {
      const tags = current || []
      const existing = tags.find(t => t.name.toLowerCase() === newTag.name.toLowerCase())
      if (existing) {
        return tags
      }
      return [...tags, newTag]
    })

    const updatedLead = {
      ...lead,
      tags: [...lead.tags, newTag]
    }

    onUpdate(updatedLead)
    setNewTagName('')
    setShowTagDialog(false)
    toast.success(t.messages.tagAdded)
  }
  
  const addExistingTag = (tag: Tag) => {
    if (lead.tags.find(t => t.id === tag.id)) {
      toast.error('Esta etiqueta ya está agregada')
      return
    }
    
    const updatedLead = {
      ...lead,
      tags: [...lead.tags, tag]
    }
    
    onUpdate(updatedLead)
    toast.success(t.messages.tagAdded)
  }

  const removeTag = (tagId: string) => {
    const updatedLead = {
      ...lead,
      tags: lead.tags.filter(t => t.id !== tagId)
    }
    onUpdate(updatedLead)
  }

  const updatePriority = (priority: string) => {
    onUpdate({ ...lead, priority: priority as Lead['priority'] })
    toast.success(t.messages.priorityUpdated)
  }
  
  const updateField = (field: keyof Lead, value: string | number) => {
    onUpdate({ ...lead, [field]: value })
    toast.success('Campo actualizado correctamente')
  }
  
  const handleAddBudget = (budget: Budget) => {
    setBudgets((current) => [...(current || []), budget])
  }
  
  const handleAddMeeting = (meeting: Meeting) => {
    setMeetings((current) => [...(current || []), meeting])
  }
  
  const handleUpdateBudget = (updatedBudget: Budget) => {
    setBudgets((current) => 
      (current || []).map(b => b.id === updatedBudget.id ? updatedBudget : b)
    )
    setEditingBudget(null)
  }
  
  const availableTags = (allTags || []).filter(tag => !lead.tags.find(t => t.id === tag.id))

  return (
    <Sheet open={open} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="p-6 border-b border-border">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="mb-2">
                <InlineEdit
                  value={lead.name}
                  onSave={(value) => updateField('name', value)}
                  displayClassName="text-2xl font-bold"
                  disabled={!canEdit}
                />
              </div>
              <div className="mb-2">
                <InlineEdit
                  value={lead.company}
                  onSave={(value) => updateField('company', value)}
                  displayClassName="text-sm text-muted-foreground"
                  disabled={!canEdit}
                />
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <InlineEdit
                  value={lead.email}
                  onSave={(value) => updateField('email', value)}
                  type="email"
                  displayClassName="text-xs"
                  disabled={!canEdit}
                />
                <InlineEdit
                  value={lead.phone}
                  onSave={(value) => updateField('phone', value)}
                  type="tel"
                  displayClassName="text-xs"
                  disabled={!canEdit}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Select value={lead.priority} onValueChange={updatePriority} disabled={!canEdit}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low Priority</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            {lead.tags.map(tag => (
              <Badge 
                key={tag.id}
                className="gap-1"
                style={{ backgroundColor: tag.color, color: 'white' }}
              >
                {tag.name}
                <button onClick={() => removeTag(tag.id)} className="hover:opacity-70">
                  <X size={12} />
                </button>
              </Badge>
            ))}
            <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus size={14} className="mr-1" />
                  {t.lead.addTag}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t.lead.addTag}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {availableTags.length > 0 && (
                    <div>
                      <Label>Etiquetas Existentes</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {availableTags.map(tag => (
                          <Badge
                            key={tag.id}
                            className="cursor-pointer"
                            style={{ backgroundColor: tag.color, color: 'white' }}
                            onClick={() => {
                              addExistingTag(tag)
                              setShowTagDialog(false)
                            }}
                          >
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                      <Separator className="my-4" />
                    </div>
                  )}
                  <div>
                    <Label>Nueva Etiqueta</Label>
                    <Input 
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="Nombre de etiqueta"
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Color</Label>
                    <Input 
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                    />
                  </div>
                  <Button onClick={addNewTag} className="w-full">{t.buttons.add}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="mx-6 mt-4">
            <TabsTrigger value="overview">{t.tabs.overview}</TabsTrigger>
            <TabsTrigger value="chat">{t.tabs.chat}</TabsTrigger>
            <TabsTrigger value="budget">{t.tabs.budget}</TabsTrigger>
            <TabsTrigger value="meetings">{t.tabs.meetings}</TabsTrigger>
            <TabsTrigger value="notes">{t.tabs.notes}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex-1 p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">{t.lead.assignedTo}</Label>
                <p className="font-medium mt-1">
                  {teamMembers.find(m => m.id === lead.assignedTo)?.name || lead.assignedTo || 'Sin asignar'}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t.lead.budget}</Label>
                <div className="mt-1">
                  <InlineEdit
                    value={lead.budget}
                    onSave={(value) => updateField('budget', value)}
                    type="number"
                    prefix="$"
                    displayClassName="font-medium text-primary"
                    disabled={!canEdit}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t.lead.createdAt}</Label>
                <p className="font-medium mt-1">{format(new Date(lead.createdAt), 'MMM d, yyyy')}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t.lead.lastContact}</Label>
                <p className="font-medium mt-1">{format(new Date(lead.lastContact), 'MMM d, yyyy')}</p>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-3">Actividad Reciente</h3>
              <div className="space-y-2">
                {leadMessages.slice(-3).map(msg => {
                  const Icon = getChannelIcon(msg.channel)
                  return (
                    <div key={msg.id} className="text-sm p-2 bg-muted rounded">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-muted-foreground">
                          <Icon size={14} />
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(msg.timestamp), 'MMM d, h:mm a')}
                        </span>
                      </div>
                      <p>{msg.content}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="chat" className="flex-1 flex flex-col p-6">
            <div className="flex gap-2 mb-4 flex-wrap">
              {(Object.keys(channelIcons) as Channel[]).map(channel => {
                const Icon = getChannelIcon(channel)
                return (
                  <Button
                    key={channel}
                    variant={selectedChannel === channel ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedChannel(channel)}
                  >
                    <Icon size={16} className="mr-2" />
                    {channel}
                  </Button>
                )
              })}
            </div>

            <ScrollArea className="flex-1 pr-4 mb-4">
              <div className="space-y-3">
                {leadMessages
                  .filter(m => m.channel === selectedChannel)
                  .map(msg => (
                    <div 
                      key={msg.id}
                      className={cn(
                        'p-3 rounded-lg max-w-[80%]',
                        msg.sender === 'team' 
                          ? 'ml-auto bg-primary text-primary-foreground'
                          : 'bg-muted'
                      )}
                    >
                      <p className="text-sm">{msg.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {format(new Date(msg.timestamp), 'h:mm a')}
                      </p>
                    </div>
                  ))}
                {leadMessages.filter(m => m.channel === selectedChannel).length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-8">
                    {t.chat.noMessages}
                  </p>
                )}
              </div>
            </ScrollArea>

            <div className="flex gap-2">
              <Input
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder={t.chat.typeMessage}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                disabled={!canEdit}
              />
              <Button onClick={sendMessage} disabled={!canEdit}>
                <PaperPlaneRight size={20} />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="budget" className="flex-1 p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{t.budget.title}</h3>
                {canEdit && (
                  <Button size="sm" onClick={() => setShowBudgetDialog(true)}>
                    <Plus size={16} className="mr-2" />
                    {t.budget.newBudget}
                  </Button>
                )}
              </div>

              {leadBudgets.map(budget => (
                <div key={budget.id} className="p-4 border border-border rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-medium">{budget.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(budget.createdAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>{budget.status}</Badge>
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingBudget(budget)}
                        >
                          <PencilSimple size={16} />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="text-right mt-4">
                    <p className="text-2xl font-bold text-primary">${budget.total.toLocaleString()}</p>
                  </div>
                </div>
              ))}

              {leadBudgets.length === 0 && (
                <p className="text-center text-muted-foreground py-8">{t.budget.noBudgets}</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="meetings" className="flex-1 p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{t.meeting.title}</h3>
                {canEdit && (
                  <Button size="sm" onClick={() => setShowMeetingDialog(true)}>
                    <Plus size={16} className="mr-2" />
                    {t.meeting.addMeeting}
                  </Button>
                )}
              </div>

              {leadMeetings.map(meeting => (
                <div key={meeting.id} className="p-4 border border-border rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-medium">{meeting.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(meeting.date), 'MMM d, yyyy h:mm a')} • {meeting.duration}min
                      </p>
                    </div>
                  </div>
                  <p className="text-sm mt-2">{meeting.notes}</p>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {t.meeting.participants}: {meeting.participants.join(', ')}
                  </div>
                </div>
              ))}

              {leadMeetings.length === 0 && (
                <p className="text-center text-muted-foreground py-8">{t.meeting.noMeetings}</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="notes" className="flex-1 p-6 flex flex-col">
            <div className="mb-4">
              <Textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder={t.notes.placeholder}
                className="mb-2"
                disabled={!canEdit}
              />
              <Button onClick={addNote} size="sm" disabled={!canEdit}>
                <NoteIcon size={16} className="mr-2" />
                {t.notes.addNote}
              </Button>
            </div>

            <ScrollArea className="flex-1">
              <div className="space-y-3">
                {leadNotes.map(note => (
                  <div key={note.id} className="p-3 border border-border rounded-lg">
                    <p className="text-sm">{note.content}</p>
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                      <span>{note.createdBy}</span>
                      <span>{format(new Date(note.createdAt), 'MMM d, yyyy h:mm a')}</span>
                    </div>
                  </div>
                ))}
                {leadNotes.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">{t.notes.noNotes}</p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
      
      <AddBudgetDialog
        leadId={lead.id}
        open={showBudgetDialog}
        onClose={() => setShowBudgetDialog(false)}
        onAdd={handleAddBudget}
      />
      
      <AddMeetingDialog
        leadId={lead.id}
        open={showMeetingDialog}
        onClose={() => setShowMeetingDialog(false)}
        onAdd={handleAddMeeting}
      />
      
      {editingBudget && (
        <EditBudgetDialog
          budget={editingBudget}
          open={true}
          onClose={() => setEditingBudget(null)}
          onUpdate={handleUpdateBudget}
        />
      )}
    </Sheet>
  )
}
