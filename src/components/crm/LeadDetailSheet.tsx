import { useState, useEffect, useRef, useCallback } from 'react'
import { Lead, Message, Note, Budget, Meeting, Channel, Tag, TeamMember } from '@/lib/types'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
// Eliminamos dependencias de KV para evitar 401 y enfocarnos en chat realtime
import { getMessages, sendMessage as sendDbMessage, subscribeToMessages, deleteMessage, deleteConversation, markMessagesAsRead, uploadChatAttachment } from '@/supabase/services/mensajes'
import { getNotasByLead, createNota, deleteNota } from '@/supabase/services/notas'
import { getLeadMeetings, createLeadMeeting, deleteLeadMeeting } from '@/supabase/services/reuniones'
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
  PencilSimple,
  Trash,
  DownloadSimple,
  FilePdf,
  File as FileIcon,
  Paperclip,
  Spinner,
  Microphone,
  Stop,
  Check,
  WarningCircle
} from '@phosphor-icons/react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { AddBudgetDialog, AddMeetingDialog, EditBudgetDialog } from './leads/dialogs'
import type { AddMeetingFormData } from './leads/dialogs'
import { InlineEdit } from './InlineEdit'
import { useTranslation } from '@/lib/i18n'
import { getPresupuestosByLead, uploadPresupuestoPdf, deletePresupuestoPdf, PresupuestoPdf } from '@/supabase/services/presupuestosPdf'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { safeFormatDate } from '@/hooks/useDateFormat'
import { NotesTab, MeetingsTab, OverviewTab, ChatTab } from './lead-detail'

interface User {
  id: string
  email: string
  businessName: string
}

interface LeadDetailSheetProps {
  lead: Lead
  open: boolean
  onClose: () => void
  onUpdate: (lead: Lead) => void
  teamMembers?: TeamMember[]
  canEdit?: boolean
  currentUser?: User | null
  onMarkAsRead?: (leadId: string) => void
  companyId?: string
  canDeleteLead?: boolean
  onDeleteLead?: (leadId: string) => void | Promise<void>
}

// NOTA: formatSafeDate ahora viene de useDateFormat hook como safeFormatDate
// Usamos fallback 'Invalid date' para mantener compatibilidad
const formatSafeDate = (date: any, fmt: string) => safeFormatDate(date, fmt, { fallback: 'Invalid date' })

// Límite máximo de presupuesto: 10 millones de dólares
const MAX_BUDGET = 10_000_000

export function LeadDetailSheet({ lead, open, onClose, onUpdate, teamMembers = [], canEdit = true, currentUser, onMarkAsRead, companyId, canDeleteLead = false, onDeleteLead }: LeadDetailSheetProps) {
  const t = useTranslation('es')
  const [messages, setMessages] = useState<Message[]>([])
  // Estados locales para evitar errores de autenticación del KV.
  // Nos enfocamos en el chat; estos estados se mantienen locales.
  const [notes, setNotes] = useState<Note[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])

  // Estados para PDFs de presupuestos
  const [presupuestosPdf, setPresupuestosPdf] = useState<PresupuestoPdf[]>([])
  const [pdfNombre, setPdfNombre] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [isUploadingPdf, setIsUploadingPdf] = useState(false)
  const pdfInputRef = useRef<HTMLInputElement | null>(null)

  const [activeTab, setActiveTab] = useState('overview')
  const [messageInput, setMessageInput] = useState('')
  const [selectedChannel, setSelectedChannel] = useState<Channel>('whatsapp')
  const NIL_UUID = '00000000-0000-0000-0000-000000000000'
  const [assignedTo, setAssignedTo] = useState<string | null>(lead.assignedTo || null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Hook de grabación de audio (antes era código duplicado de ~120 líneas)
  const handleAudioReady = useCallback(async (audioBlob: Blob, audioFile: File) => {
    setIsUploading(true)
    try {
      const mediaData = await uploadChatAttachment(audioFile, lead.id)
      const sentMsg = await sendDbMessage(lead.id, '', 'team', selectedChannel, mediaData)
      if (sentMsg) {
        const mappedMsg = {
          id: sentMsg.id,
          leadId: sentMsg.lead_id,
          channel: sentMsg.channel as Channel,
          content: sentMsg.content,
          timestamp: new Date(sentMsg.created_at),
          sender: sentMsg.sender as 'team' | 'lead',
          read: sentMsg.read || false
        }
        setMessages(prev => prev.find(p => p.id === mappedMsg.id) ? prev : [...prev, mappedMsg])
      }
      toast.success('Nota de voz enviada')
    } catch (err) {
      console.error('[Audio] Error sending:', err)
      toast.error('Error enviando nota de voz')
    } finally {
      setIsUploading(false)
    }
  }, [lead.id, selectedChannel])

  const { isRecording, recordingTime, startRecording, stopRecording } = useAudioRecorder({
    onAudioReady: handleAudioReady,
    onError: (error) => toast.error(error.message || 'No se pudo acceder al micrófono')
  })


  // NOTA: startRecording y stopRecording ahora vienen del hook useAudioRecorder
  // Se eliminaron ~120 líneas de código duplicado

  useEffect(() => {
    if (!lead.id || !open) return

    // Fetch initial messages
    getMessages(lead.id).then(dbMessages => {
      const mapped = dbMessages.map(m => ({
        id: m.id,
        leadId: m.lead_id,
        channel: m.channel as Channel,
        content: m.content,
        timestamp: new Date(m.created_at),
        sender: m.sender as 'team' | 'lead',
        read: m.read,
        metadata: m.metadata
      }))
      setMessages(mapped)
      console.log('[Chat] mensajes iniciales cargados:', mapped.length)

      // Marcar mensajes como leídos si hay mensajes no leídos
      const hasUnread = mapped.some(m => !m.read && m.sender === 'lead')
      if (hasUnread) {
        markMessagesAsRead(lead.id)
          .then(() => {
            if (onMarkAsRead) onMarkAsRead(lead.id)
          })
          .catch(console.error)
      }
    })

    // Fetch notas from database
    getNotasByLead(lead.id).then(dbNotas => {
      const mapped: Note[] = dbNotas.map((n: any) => ({
        id: n.id,
        leadId: n.lead_id,
        content: n.contenido,
        createdBy: n.creador_nombre || 'Usuario',
        createdAt: new Date(n.created_at)
      }))
      setNotes(mapped)
      console.log('[Notas] notas cargadas:', mapped.length)
    }).catch(err => {
      console.error('[Notas] Error cargando notas:', err)
    })

    // Subscribe to new messages
    const subscription = subscribeToMessages(lead.id, (newMsg) => {
      const mapped = {
        id: newMsg.id,
        leadId: newMsg.lead_id,
        channel: newMsg.channel as Channel,
        content: newMsg.content,
        timestamp: new Date(newMsg.created_at),
        sender: newMsg.sender as 'team' | 'lead',
        read: newMsg.read,
        metadata: newMsg.metadata
      }
      console.log('[Chat] nuevo mensaje realtime:', mapped)
      setMessages(prev => {
        // Avoid duplicates just in case
        if (prev.find(p => p.id === mapped.id)) return prev
        return [...prev, mapped]
      })
    })

    return () => {
      subscription.unsubscribe()
      console.log('[Chat] suscripción realtime cancelada')
    }
  }, [lead.id, open])

  useEffect(() => {
    if (!lead.id) return
    if (!open) {
      setMeetings([])
      return
    }

    let isMounted = true
    getLeadMeetings(lead.id)
      .then((data) => {
        if (isMounted) {
          setMeetings(data)
        }
      })
      .catch((err) => {
        console.error('[Meetings] Error cargando reuniones:', err)
      })

    return () => {
      isMounted = false
    }
  }, [lead.id, open])

  // Cargar PDFs de presupuestos
  useEffect(() => {
    if (!lead.id || !open) {
      setPresupuestosPdf([])
      return
    }

    getPresupuestosByLead(lead.id)
      .then(setPresupuestosPdf)
      .catch(err => console.error('[Presupuestos PDF] Error cargando:', err))
  }, [lead.id, open])

  // Auto-scroll al último mensaje cuando cambian los mensajes, se abre el chat o se cambia de canal
  useEffect(() => {
    if (!messagesEndRef.current) return
    if (activeTab === 'chat') {
      // Pequeño timeout para asegurar que el DOM se actualizó con los mensajes del nuevo canal
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
      }, 100)
    }
  }, [messages, activeTab, selectedChannel])

  const handleUpdateAssignedTo = (value: string) => {
    // Mapear 'todos' a UUID nulo; miembros específicos pasan su id
    const newAssigned = value === 'todos' ? NIL_UUID : value
    setAssignedTo(newAssigned)
    onUpdate({ ...lead, assignedTo: newAssigned })
  }
  const [noteInput, setNoteInput] = useState('')
  const [showTagDialog, setShowTagDialog] = useState(false)
  const [showBudgetDialog, setShowBudgetDialog] = useState(false)
  const [showMeetingDialog, setShowMeetingDialog] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#3b82f6')
  const [deletingMeetingId, setDeletingMeetingId] = useState<string | null>(null)

  const leadMessages = messages // Now we fetch specific messages for this lead
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

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteMessage(messageId)
      setMessages(prev => prev.filter(m => m.id !== messageId))
      toast.success('Mensaje eliminado')
    } catch (e) {
      console.error(e)
      toast.error('Error eliminando mensaje')
    }
  }

  const handleDeleteConversation = async () => {
    try {
      await deleteConversation(lead.id)
      setMessages([])
      toast.success('Conversación eliminada')
    } catch (e) {
      console.error(e)
      toast.error('Error eliminando conversación')
    }
  }

  const sendMessage = async () => {
    if (!messageInput.trim()) return

    try {
      const sentMsg = await sendDbMessage(lead.id, messageInput, 'team', selectedChannel)

      // Actualización optimista: Agregamos el mensaje a la lista inmediatamente
      if (sentMsg) {
        const mappedMsg = {
          id: sentMsg.id,
          leadId: sentMsg.lead_id,
          channel: sentMsg.channel as Channel,
          content: sentMsg.content,
          timestamp: new Date(sentMsg.created_at),
          sender: sentMsg.sender as 'team' | 'lead',
          read: sentMsg.read || false
        }

        setMessages(prev => {
          if (prev.find(p => p.id === mappedMsg.id)) return prev
          return [...prev, mappedMsg]
        })
      }

      setMessageInput('')
      toast.success(t.messages.messageSent)
    } catch (e: any) {
      console.error(e)
      toast.error(`Error: ${e.message || 'No se pudo enviar el mensaje'}`)
    }
  }

  // Handler para subir archivos desde ChatTab
  const handleFileUpload = async (file: File) => {
    setIsUploading(true)
    try {
      const mediaData = await uploadChatAttachment(file, lead.id)
      const sentMsg = await sendDbMessage(lead.id, messageInput || '', 'team', selectedChannel, mediaData)
      if (sentMsg) {
        const mappedMsg = {
          id: sentMsg.id,
          leadId: sentMsg.lead_id,
          channel: sentMsg.channel as Channel,
          content: sentMsg.content,
          timestamp: new Date(sentMsg.created_at),
          sender: sentMsg.sender as 'team' | 'lead',
          read: sentMsg.read || false
        }
        setMessages(prev => prev.find(p => p.id === mappedMsg.id) ? prev : [...prev, mappedMsg])
      }
      setMessageInput('')
      toast.success('Archivo enviado')
    } catch (err) {
      console.error(err)
      toast.error('Error enviando archivo')
    } finally {
      setIsUploading(false)
    }
  }

  const addNote = async () => {
    if (!noteInput.trim()) return

    try {
      // Buscar nombre: primero en equipos, luego businessName, luego email
      const teamMember = teamMembers.find(m => m.userId === currentUser?.id)
      const creadorNombre = teamMember?.name || currentUser?.businessName || currentUser?.email || 'Usuario'
      const dbNota = await createNota(lead.id, noteInput, creadorNombre)

      const newNote: Note = {
        id: dbNota.id,
        leadId: lead.id,
        content: noteInput,
        createdBy: creadorNombre,
        createdAt: new Date(dbNota.created_at)
      }

      setNotes((current) => [newNote, ...(current || [])])
      setNoteInput('')
      toast.success(t.messages.noteAdded)
    } catch (err) {
      console.error('[Notas] Error creando nota:', err)
      toast.error('Error al guardar la nota')
    }
  }

  const addNewTag = async () => {
    if (!newTagName.trim()) return

    // Validar longitud máxima (20 caracteres)
    const MAX_TAG_LENGTH = 20
    const trimmedName = newTagName.trim().slice(0, MAX_TAG_LENGTH)

    if (trimmedName.length === 0) {
      toast.error('El nombre de la etiqueta no puede estar vacío')
      return
    }

    const newTag: Tag = {
      id: Date.now().toString(),
      name: trimmedName,
      color: newTagColor
    }

    // Optimistic update
    setAllTags((current) => {
      const tags = current || []
      const existing = tags.find(t => t.name.toLowerCase() === newTag.name.toLowerCase())
      if (existing) return tags
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

    // Persist
    try {
      const { addTagToLead } = await import('@/supabase/services/tags')
      await addTagToLead(lead.id, lead.tags, newTag)
    } catch (e) {
      console.error('Error saving tag:', e)
      toast.error('Error al guardar la etiqueta en BD')
      // Rollback could be added here
    }
  }

  const addExistingTag = async (tag: Tag) => {
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

    // Persist
    try {
      const { addTagToLead } = await import('@/supabase/services/tags')
      await addTagToLead(lead.id, lead.tags, tag)
    } catch (e) {
      console.error('Error adding existing tag:', e)
      toast.error('Error al guardar la etiqueta')
    }
  }

  const removeTag = async (tagId: string) => {
    const updatedLead = {
      ...lead,
      tags: lead.tags.filter(t => t.id !== tagId)
    }
    onUpdate(updatedLead)

    // Persist
    try {
      const { removeTagFromLead } = await import('@/supabase/services/tags')
      await removeTagFromLead(lead.id, lead.tags, tagId)
      toast.success('Etiqueta eliminada')
    } catch (e) {
      console.error('Error removing tag:', e)
      toast.error('Error al eliminar etiqueta de BD')
    }
  }

  const updatePriority = (priority: string) => {
    onUpdate({ ...lead, priority: priority as Lead['priority'] })
    toast.success(t.messages.priorityUpdated)
  }

  const updateField = async (field: keyof Lead, value: string | number) => {
    if (field === 'evento' || field === 'membresia') {
      const textValue = String(value ?? '').trim()
      if (textValue.length > 80) {
        toast.error(`${field === 'evento' ? 'Evento' : 'Membresía'} no puede superar 80 caracteres`)
        return
      }
      value = textValue
    }

    if (field === 'budget') {
      const numValue = typeof value === 'number' ? value : parseFloat(value)
      if (numValue < 0) {
        toast.error('El presupuesto no puede ser negativo')
        return
      }
      if (numValue > MAX_BUDGET) {
        toast.error(`El presupuesto no puede superar $${MAX_BUDGET.toLocaleString()}`)
        return
      }
    }

    // Actualizar optimísticamente en la UI
    onUpdate({ ...lead, [field]: value })

    // Mapeo de campos frontend -> base de datos (snake_case)
    const dbFieldMap: Record<string, string> = {
      name: 'nombre_completo',
      email: 'correo_electronico',
      phone: 'telefono',
      company: 'empresa',
      evento: 'evento',
      membresia: 'membresia',
      budget: 'presupuesto',
      priority: 'prioridad',
      assignedTo: 'asignado_a',
      pipeline_id: 'pipeline_id',
      stage_id: 'etapa_id',
      notes: 'notas',
      source: 'fuente',
      value: 'valor'
      // Agrega más mapeos según sea necesario si difieren
    }

    const dbField = dbFieldMap[field as string] || field

    // Persistir en la BD
    try {
      const { updateLead } = await import('@/supabase/services/leads')
      await updateLead(lead.id, { [dbField]: value })
      // toast.success('Campo guardado') // Opcional, ya mostramos success local
    } catch (e) {
      console.error('Error updating lead field:', e)
      toast.error('Error guardando cambios del lead')
      // Revertir optimismo si fuera necesario, pero por ahora lo dejamos
    }
  }

  const handleAddBudget = (budget: Budget) => {
    setBudgets((current) => [...(current || []), budget])
  }

  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteNota(noteId)
      setNotes((current) => (current || []).filter(n => n.id !== noteId))
      toast.success('Nota eliminada')
    } catch (err) {
      console.error('[Notas] Error eliminando nota:', err)
      toast.error('Error al eliminar la nota')
    }
  }

  const handleAddMeeting = async (meeting: AddMeetingFormData) => {
    if (!companyId) {
      throw new Error('No hay empresa activa seleccionada')
    }

    try {
      const created = await createLeadMeeting({
        leadId: lead.id,
        empresaId: companyId,
        title: meeting.title,
        date: meeting.date,
        duration: meeting.duration,
        participants: meeting.participants,
        notes: meeting.notes,
        createdBy: currentUser?.id || null
      })

      setMeetings((current) => {
        const next = [...(current || []), created]
        return next.sort((a, b) => a.date.getTime() - b.date.getTime())
      })
    } catch (error) {
      console.error('[Meetings] Error creando reunión:', error)
      throw error
    }
  }

  const handleDeleteMeeting = async (meetingId: string) => {
    setDeletingMeetingId(meetingId)
    try {
      await deleteLeadMeeting(meetingId)
      setMeetings((current) => (current || []).filter(m => m.id !== meetingId))
      toast.success('Reunión eliminada')
    } catch (error) {
      console.error('[Meetings] Error eliminando reunión:', error)
      toast.error('No se pudo eliminar la reunión')
    } finally {
      setDeletingMeetingId(null)
    }
  }

  const handleUpdateBudget = (updatedBudget: Budget) => {
    setBudgets((current) =>
      (current || []).map(b => b.id === updatedBudget.id ? updatedBudget : b)
    )
    setEditingBudget(null)
  }

  // Handlers para PDFs de presupuestos
  const handleUploadPdf = async () => {
    if (!pdfFile || !pdfNombre.trim()) {
      toast.error('Selecciona un archivo PDF y escribe un nombre')
      return
    }
    setIsUploadingPdf(true)
    try {
      const uploaded = await uploadPresupuestoPdf(lead.id, pdfFile, pdfNombre.trim())
      setPresupuestosPdf(prev => [uploaded, ...prev])
      setPdfFile(null)
      setPdfNombre('')
      if (pdfInputRef.current) pdfInputRef.current.value = ''
      toast.success('PDF subido exitosamente')
    } catch (err: any) {
      console.error('[Presupuestos PDF] Error subiendo:', err)
      toast.error(err.message || 'Error al subir el PDF')
    } finally {
      setIsUploadingPdf(false)
    }
  }

  const handleDeletePdf = async (pdf: PresupuestoPdf) => {
    try {
      await deletePresupuestoPdf(pdf.id, pdf.url)
      setPresupuestosPdf(prev => prev.filter(p => p.id !== pdf.id))
      toast.success('PDF eliminado')
    } catch (err) {
      console.error('[Presupuestos PDF] Error eliminando:', err)
      toast.error('Error al eliminar el PDF')
    }
  }

  const availableTags = (allTags || []).filter(tag => !lead.tags.find(t => t.id === tag.id))
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex h-full max-h-[100dvh] flex-col overflow-hidden">
        <SheetHeader className="p-5 sm:p-6 border-b border-border">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1 min-w-0">
              <div className="mb-2">
                <InlineEdit
                  value={lead.name}
                  onSave={(value) => updateField('name', value)}
                  displayClassName="text-2xl font-bold"
                  disabled={!canEdit}
                  placeholder="Nombre del lead"
                />
              </div>
              <div className="mb-2">
                <InlineEdit
                  value={lead.company}
                  onSave={(value) => updateField('company', value)}
                  displayClassName="text-sm text-muted-foreground"
                  disabled={!canEdit}
                  placeholder="Empresa"
                />
              </div>
              <div className="flex items-start gap-2 mt-2 flex-wrap">
                <InlineEdit
                  value={lead.email}
                  onSave={(value) => updateField('email', value)}
                  type="email"
                  displayClassName="text-xs"
                  disabled={!canEdit}
                  placeholder="correo@ejemplo.com"
                />
                <InlineEdit
                  value={lead.phone}
                  onSave={(value) => updateField('phone', value)}
                  type="tel"
                  displayClassName="text-xs"
                  disabled={!canEdit}
                  placeholder="+1 234 567 8900"
                />
                <InlineEdit
                  value={lead.location || ''}
                  onSave={(value) => updateField('location', value)}
                  displayClassName="text-xs"
                  disabled={!canEdit}
                  placeholder="Ubicación"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <Select value={lead.priority} onValueChange={updatePriority} disabled={!canEdit}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low Priority</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High Priority</SelectItem>
                </SelectContent>
              </Select>
              {canDeleteLead && (
                <Button variant="destructive" size="sm" onClick={() => setConfirmDeleteOpen(true)} className="mt-2 sm:mt-0">
                  <Trash className="w-4 h-4 mr-2" />
                  Eliminar Lead
                </Button>
              )}
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
                  <DialogDescription className="text-xs text-muted-foreground">
                    Crea o selecciona etiquetas para organizar este chat.
                  </DialogDescription>
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
                      placeholder="Nombre (máx. 20 car.)"
                      maxLength={20}
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

        {canDeleteLead && (
          <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminar lead</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción eliminará el lead y su conversación. No se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => { try { await onDeleteLead?.(lead.id) } finally { setConfirmDeleteOpen(false) } }}>
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="mx-4 sm:mx-6 mt-3 sm:mt-4 flex flex-wrap gap-2 rounded-lg bg-muted/60 p-1">
            <TabsTrigger value="overview">{t.tabs.overview}</TabsTrigger>
            <TabsTrigger value="chat">{t.tabs.chat}</TabsTrigger>
            <TabsTrigger value="budget">{t.tabs.budget}</TabsTrigger>
            <TabsTrigger value="meetings">{t.tabs.meetings}</TabsTrigger>
            <TabsTrigger value="notes">{t.tabs.notes}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex-1 overflow-y-auto">
            <OverviewTab
              lead={lead}
              teamMembers={teamMembers}
              currentUser={currentUser}
              assignedTo={assignedTo}
              onUpdateAssignedTo={handleUpdateAssignedTo}
              onUpdateField={updateField}
              recentMessages={leadMessages}
              canEdit={canEdit}
              maxBudget={MAX_BUDGET}
              translations={{
                assignedTo: t.lead.assignedTo,
                budget: t.lead.budget,
                createdAt: t.lead.createdAt,
                lastContact: t.lead.lastContact
              }}
            />
          </TabsContent>

          <TabsContent value="chat" className="flex-1 flex flex-col overflow-hidden">
            <ChatTab
              leadId={lead.id}
              messages={leadMessages}
              selectedChannel={selectedChannel}
              onChannelChange={setSelectedChannel}
              messageInput={messageInput}
              onMessageInputChange={setMessageInput}
              onSendMessage={sendMessage}
              onDeleteMessage={handleDeleteMessage}
              onDeleteConversation={handleDeleteConversation}
              onFileUpload={handleFileUpload}
              isUploading={isUploading}
              canEdit={canEdit}
              messagesEndRef={messagesEndRef as React.RefObject<HTMLDivElement>}
              isRecording={isRecording}
              recordingTime={recordingTime}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              translations={{
                noMessages: t.chat.noMessages,
                typeMessage: t.chat.typeMessage
              }}
            />
          </TabsContent>

          <TabsContent value="budget" className="flex-1 p-6 overflow-y-auto">
            <div className="space-y-6">
              {/* Sección de PDFs de presupuestos */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">📄 Documentos de Presupuesto</h3>
                </div>

                {/* Formulario para subir PDF */}
                {canEdit && (
                  <div className="p-4 border border-dashed border-border rounded-lg bg-muted/30 space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Input
                        value={pdfNombre}
                        onChange={(e) => setPdfNombre(e.target.value)}
                        placeholder="Nombre del presupuesto"
                        className="flex-1"
                      />
                      <input
                        ref={pdfInputRef}
                        type="file"
                        accept="*"
                        onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        onClick={() => pdfInputRef.current?.click()}
                        disabled={isUploadingPdf}
                        className="gap-2"
                      >
                        <FilePdf size={16} />
                        {pdfFile ? pdfFile.name.slice(0, 20) + (pdfFile.name.length > 20 ? '...' : '') : 'Seleccionar PDF'}
                      </Button>
                    </div>
                    <Button
                      onClick={handleUploadPdf}
                      disabled={!pdfFile || !pdfNombre.trim() || isUploadingPdf}
                      className="w-full"
                    >
                      {isUploadingPdf ? (
                        <>
                          <Spinner size={16} className="mr-2 animate-spin" />
                          Subiendo...
                        </>
                      ) : (
                        <>
                          <Plus size={16} className="mr-2" />
                          Subir PDF
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Lista de PDFs */}
                {presupuestosPdf.length > 0 ? (
                  <div className="space-y-2">
                    {presupuestosPdf.map(pdf => (
                      <div key={pdf.id} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <FilePdf size={24} className="text-red-500 flex-shrink-0" weight="fill" />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{pdf.nombre}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatSafeDate(pdf.created_at, 'dd MMM yyyy, HH:mm')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(pdf.url, '_blank')}
                          >
                            <DownloadSimple size={16} className="mr-1" />
                            Ver
                          </Button>
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeletePdf(pdf)}
                            >
                              <Trash size={16} />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    No hay documentos de presupuesto
                  </p>
                )}
              </div>

              <Separator />

              {/* Sección antigua de presupuestos (marcada como no funcional) */}
              <div className="space-y-4 opacity-60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{t.budget.title}</h3>
                    <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                      No funcional
                    </Badge>
                  </div>
                  {canEdit && (
                    <Button size="sm" variant="outline" disabled onClick={() => setShowBudgetDialog(true)}>
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
                          {formatSafeDate(budget.createdAt, 'MMM d, yyyy')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge>{budget.status}</Badge>
                      </div>
                    </div>
                    <div className="text-right mt-4">
                      <p className="text-2xl font-bold text-primary">${budget.total.toLocaleString()}</p>
                    </div>
                  </div>
                ))}

                {leadBudgets.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    {t.budget.noBudgets}
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="meetings" className="flex-1 overflow-y-auto">
            <MeetingsTab
              meetings={leadMeetings}
              onShowMeetingDialog={() => setShowMeetingDialog(true)}
              onDeleteMeeting={handleDeleteMeeting}
              deletingMeetingId={deletingMeetingId}
              canEdit={canEdit}
              translations={{
                title: t.meeting.title,
                addMeeting: t.meeting.addMeeting,
                noMeetings: t.meeting.noMeetings,
                participants: t.meeting.participants
              }}
            />
          </TabsContent>

          <TabsContent value="notes" className="flex-1 overflow-y-auto">
            <NotesTab
              notes={leadNotes}
              noteInput={noteInput}
              onNoteInputChange={setNoteInput}
              onAddNote={addNote}
              onDeleteNote={handleDeleteNote}
              canEdit={canEdit}
              translations={{
                placeholder: t.notes.placeholder,
                addNote: t.notes.addNote,
                noNotes: t.notes.noNotes
              }}
            />
          </TabsContent>
        </Tabs >
      </SheetContent >

      <AddBudgetDialog
        leadId={lead.id}
        open={showBudgetDialog}
        onClose={() => setShowBudgetDialog(false)}
        onAdd={handleAddBudget}
      />

      <AddMeetingDialog
        leadId={lead.id}
        empresaId={companyId || ''}
        open={showMeetingDialog}
        onClose={() => setShowMeetingDialog(false)}
        onAdd={handleAddMeeting}
        teamMembers={teamMembers}
      />

      {
        editingBudget && (
          <EditBudgetDialog
            budget={editingBudget}
            open={true}
            onClose={() => setEditingBudget(null)}
            onUpdate={handleUpdateBudget}
          />
        )
      }
    </Sheet >
  )
}
