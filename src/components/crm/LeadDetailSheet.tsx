import { useState, useEffect, useRef } from 'react'
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
import { format } from 'date-fns'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
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
import { AddBudgetDialog } from './AddBudgetDialog'
import { AddMeetingDialog, AddMeetingFormData } from './AddMeetingDialog'
import { EditBudgetDialog } from './EditBudgetDialog'
import { InlineEdit } from './InlineEdit'
import { useTranslation } from '@/lib/i18n'
import { getPresupuestosByLead, uploadPresupuestoPdf, deletePresupuestoPdf, PresupuestoPdf } from '@/supabase/services/presupuestosPdf'

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

// Helper function to safely format dates
const formatSafeDate = (date: Date | string | null | undefined, formatStr: string): string => {
  if (!date) return 'Invalid date'
  const dateObj = date instanceof Date ? date : new Date(date)
  if (isNaN(dateObj.getTime())) return 'Invalid date'
  return format(dateObj, formatStr)
}

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

  // Estados para grabación de audio
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Función para detener la grabación
  const stopRecording = () => {
    console.log('[Audio] Stopping recording...')
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current)
      recordingIntervalRef.current = null
    }
  }

  // Función para iniciar la grabación
  const startRecording = async () => {
    try {
      console.log('[Audio] Starting recording...')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Priorizar OGG/Opus (formato nativo de WhatsApp) para mejor compatibilidad
      let mimeType = ''
      const preferredFormats = [
        'audio/ogg;codecs=opus',  // Formato nativo de WhatsApp
        'audio/ogg',
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm'
      ]

      for (const format of preferredFormats) {
        if (MediaRecorder.isTypeSupported(format)) {
          mimeType = format
          break
        }
      }
      console.log('[Audio] Using mimeType:', mimeType || 'default')

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        console.log('[Audio] Data available:', event.data.size)
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        console.log('[Audio] onstop triggered, chunks:', audioChunksRef.current.length)

        // Detener el stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }

        // Limpiar estado de grabación inmediatamente
        setRecordingTime(0)
        setIsRecording(false)

        // Crear el archivo de audio
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' })
        console.log('[Audio] Blob created:', audioBlob.size, 'bytes')

        if (audioBlob.size === 0) {
          toast.error('No se grabó audio')
          return
        }

        // Forzar formato OGG para compatibilidad con WhatsApp (notas de voz)
        // WhatsApp reconoce .ogg como formato de nota de voz
        const audioFile = new File([audioBlob], `voice-note-${Date.now()}.ogg`, {
          type: 'audio/ogg'
        })
        console.log('[Audio] File created as OGG for WhatsApp compatibility')

        // Subir y enviar
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
      }

      // Usar timeslice de 500ms para capturar datos durante la grabación
      mediaRecorder.start(500)
      setIsRecording(true)
      setRecordingTime(0)

      // Iniciar temporizador
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

    } catch (err) {
      console.error('[Audio] Error accessing microphone:', err)
      toast.error('No se pudo acceder al micrófono')
    }
  }

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
    } catch (e) {
      console.error(e)
      toast.error('Error enviando mensaje')
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

  const addNewTag = () => {
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

  const updateField = async (field: keyof Lead, value: string | number) => {
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
      <SheetContent className="w-full sm:max-w-2xl p-0 flex h-full max-h-[100dvh] flex-col overflow-y-auto">
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 sm:mx-6 mt-3 sm:mt-4 flex flex-wrap gap-2 rounded-lg bg-muted/60 p-1">
            <TabsTrigger value="overview">{t.tabs.overview}</TabsTrigger>
            <TabsTrigger value="chat">{t.tabs.chat}</TabsTrigger>
            <TabsTrigger value="budget">{t.tabs.budget}</TabsTrigger>
            <TabsTrigger value="meetings">{t.tabs.meetings}</TabsTrigger>
            <TabsTrigger value="notes">{t.tabs.notes}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex-1 px-4 sm:px-6 py-4 sm:py-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">{t.lead.assignedTo}</Label>
                <div className="mt-1">
                  <Select value={assignedTo || 'todos'} onValueChange={handleUpdateAssignedTo} disabled={!canEdit}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {currentUser && (
                        <SelectItem value={currentUser.id}>{`${currentUser.businessName || currentUser.email || 'Yo'} (Yo)`}</SelectItem>
                      )}
                      {teamMembers.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t.lead.budget}</Label>
                <div className="mt-1">
                  <InlineEdit
                    value={lead.budget}
                    onSave={(value) => updateField('budget', value)}
                    type="number"
                    min={0}
                    max={MAX_BUDGET}
                    prefix="$"
                    displayClassName="font-medium text-primary !m-0 !p-0 hover:bg-transparent justify-start w-auto"
                    disabled={!canEdit}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t.lead.createdAt}</Label>
                <p className="font-medium mt-1">{formatSafeDate(lead.createdAt, 'MMM d, yyyy')}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t.lead.lastContact}</Label>
                <p className="font-medium mt-1">{lead.lastContact ? formatSafeDate(lead.lastContact, 'MMM d, yyyy') : 'No contactado'}</p>
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
                          {formatSafeDate(msg.timestamp, 'MMM d, h:mm a')}
                        </span>
                      </div>
                      <p>{msg.content}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="chat" className="flex-1 flex flex-col px-4 sm:px-6 py-4 sm:py-6 min-h-0 gap-3">
            <div className="flex justify-between items-center mb-4">
              <div className="flex gap-2 flex-wrap">
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

              {canEdit && leadMessages.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash size={16} className="mr-2" />
                      Limpiar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar conversación?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción eliminará todos los mensajes de este lead permanentemente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteConversation} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>

            <ScrollArea className="flex-1 pr-3 sm:pr-4 mb-4 min-h-[320px]">
              <div className="space-y-3">
                {leadMessages
                  .filter(m => m.channel === selectedChannel)
                  .map(msg => (
                    <div
                      key={msg.id}
                      className={cn(
                        'group relative p-3 rounded-lg max-w-[80%]',
                        msg.sender === 'team'
                          ? 'ml-auto bg-primary text-primary-foreground'
                          : 'bg-muted'
                      )}
                    >
                      {canEdit && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteMessage(msg.id)
                          }}
                          className={cn(
                            "absolute -top-2 p-1 rounded-full bg-destructive text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10",
                            msg.sender === 'team' ? "-left-2" : "-right-2"
                          )}
                          title="Eliminar mensaje"
                        >
                          <Trash size={12} weight="bold" />
                        </button>
                      )}
                      {/* Contenido del mensaje con indicador de tipo */}
                      {(() => {
                        const data = msg.metadata?.data || msg.metadata || {};
                        let mediaUrl =
                          data.media?.links?.download ||
                          data.media?.url ||
                          data.mediaUrl ||
                          (data.type === 'image' && data.body?.startsWith('http') ? data.body : null);

                        if (!mediaUrl && msg.content) {
                          const urlRegex = /(https?:\/\/[^\s]+)/g;
                          const matches = msg.content.match(urlRegex);
                          if (matches) {
                            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.pdf', '.csv', '.mp3', '.wav', '.ogg', '.oga', '.m4a'];
                            const foundUrl = matches.find(url => {
                              const lower = url.toLowerCase();
                              return imageExtensions.some(ext => lower.includes(ext));
                            }) || matches[matches.length - 1];
                            if (foundUrl) mediaUrl = foundUrl;
                          }
                        }

                        // Determinar el tipo de contenido
                        let contentType: string | null = null;
                        let contentIcon: string | null = null;
                        if (mediaUrl) {
                          const lowerUrl = mediaUrl.toLowerCase();
                          const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].some(ext => lowerUrl.includes(ext)) || (data.type === 'image');
                          const isVideo = ['.mp4', '.webm', '.mov'].some(ext => lowerUrl.includes(ext)) || (data.type === 'video');
                          const isAudio = ['.mp3', '.wav', '.ogg', '.oga', '.m4a', '.aac', '.opus'].some(ext => lowerUrl.includes(ext)) ||
                            (data.type === 'audio') ||
                            (data.type === 'ptt');
                          const isPdf = lowerUrl.includes('.pdf');

                          if (isAudio) {
                            contentType = data.type === 'ptt' ? 'Nota de voz' : 'Audio';
                            contentIcon = '🎤';
                          } else if (isImage) {
                            contentType = 'Imagen';
                            contentIcon = '📷';
                          } else if (isVideo) {
                            contentType = 'Video';
                            contentIcon = '🎬';
                          } else if (isPdf) {
                            contentType = 'PDF';
                            contentIcon = '📄';
                          } else {
                            contentType = 'Archivo';
                            contentIcon = '📎';
                          }
                        }

                        return (
                          <div className="space-y-1">
                            {contentType && (
                              <div className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-medium">
                                <span>{contentIcon}</span>
                                <span>{contentType}</span>
                              </div>
                            )}
                            {(() => {
                              // Si hay mediaUrl, intentamos limpiar el contenido de URLs
                              if (!msg.content) return null;

                              // Si el contenido es solo una URL, no lo mostramos
                              if (msg.content.startsWith('http')) return null;

                              // Si hay un mediaUrl detectado, quitamos las URLs del texto
                              if (mediaUrl) {
                                const urlRegex = /https?:\/\/[^\s]+/gi;
                                const cleanedContent = msg.content.replace(urlRegex, '').trim();
                                // Si después de quitar URLs queda algo útil, mostrarlo
                                if (cleanedContent && cleanedContent.length > 0) {
                                  return <p className="text-sm">{cleanedContent}</p>;
                                }
                                return null;
                              }

                              // Si no hay mediaUrl, mostrar el contenido normal
                              return <p className="text-sm">{msg.content}</p>;
                            })()}
                          </div>
                        );
                      })()}
                      {/* Renderizado de archivos multimedia */}
                      {(() => {
                        const data = msg.metadata?.data || msg.metadata || {};

                        // DEBUG: Ver qué estructura tiene la metadata
                        if (msg.metadata && !msg.read) {
                          console.log('[LeadDetailSheet] Metadata:', {
                            hasData: !!msg.metadata.data,
                            type: msg.metadata.type || msg.metadata.data?.type,
                            hasMediaUrl: !!(msg.metadata.data?.mediaUrl),
                            keys: Object.keys(msg.metadata)
                          });
                        }

                        // 1. Buscar en metadata normalizada (nueva estructura)
                        let mediaUrl =
                          data.mediaUrl ||  // Campo directo de metadata normalizada
                          data.media?.links?.download ||
                          data.media?.url ||
                          data.media?.publicUrl ||
                          data.media?.downloadUrl ||
                          (data.type === 'image' && data.body?.startsWith('http') ? data.body : null);

                        // 2. Si no hay en metadata, buscar en el contenido del mensaje
                        if (!mediaUrl && msg.content) {
                          // Regex simple para buscar URLs
                          const urlRegex = /(https?:\/\/[^\s]+)/g;
                          const matches = msg.content.match(urlRegex);
                          if (matches) {
                            // Tomamos la última URL encontrada, asumiendo que es la que adjuntamos al final
                            // O buscamos una que parezca imagen
                            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.pdf', '.csv'];
                            const foundUrl = matches.find(url => {
                              const lower = url.toLowerCase();
                              return imageExtensions.some(ext => lower.includes(ext));
                            }) || matches[matches.length - 1]; // Fallback a la última URL si no hay extensión obvia

                            if (foundUrl) mediaUrl = foundUrl;
                          }
                        }

                        if (mediaUrl) {
                          const lowerUrl = mediaUrl.toLowerCase();
                          const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].some(ext => lowerUrl.includes(ext)) || (data.type === 'image');
                          const isVideo = ['.mp4', '.webm', '.ogg', '.mov'].some(ext => lowerUrl.includes(ext)) || (data.type === 'video');
                          const isAudio = ['.mp3', '.wav', '.ogg', '.oga', '.m4a', '.aac', '.opus'].some(ext => lowerUrl.includes(ext)) ||
                            (data.type === 'audio') ||
                            (data.type === 'ptt'); // WhatsApp voice message

                          if (isImage) {
                            return (
                              <div className="mt-2 rounded-md overflow-hidden">
                                <img
                                  src={mediaUrl}
                                  alt="Imagen adjunta"
                                  className="max-w-full h-auto object-cover max-h-60"
                                  loading="lazy"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              </div>
                            );
                          } else if (isVideo) {
                            return (
                              <div className="mt-2 rounded-md overflow-hidden">
                                <video
                                  src={mediaUrl}
                                  controls
                                  className="max-w-full h-auto max-h-60"
                                />
                              </div>
                            );
                          } else if (isAudio) {
                            // Renderizado especial para audios de WhatsApp
                            return (
                              <div className="mt-2 flex items-center gap-3 bg-muted/50 p-3 rounded-md border border-border max-w-full">
                                <div className="bg-gradient-to-br from-green-500 to-green-600 p-2 rounded-full text-white shadow-sm">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" fill="currentColor">
                                    <path d="M128,176a48.05,48.05,0,0,0,48-48V64a48,48,0,0,0-96,0v64A48.05,48.05,0,0,0,128,176ZM96,64a32,32,0,0,1,64,0v64a32,32,0,0,1-64,0Zm40,143.6V232a8,8,0,0,1-16,0V207.6A80.11,80.11,0,0,1,48,128a8,8,0,0,1,16,0,64,64,0,0,0,128,0,8,8,0,0,1,16,0A80.11,80.11,0,0,1,136,207.6Z"></path>
                                  </svg>
                                </div>
                                <div className="flex-1">
                                  <p className="text-xs text-muted-foreground mb-1">
                                    {data.type === 'ptt' ? '🎤 Nota de voz' : '🔊 Audio'}
                                  </p>
                                  <audio
                                    src={mediaUrl}
                                    controls
                                    className="w-full max-w-sm h-8"
                                    style={{ maxHeight: '32px' }}
                                  >
                                    Tu navegador no soporta reproducción de audio.
                                  </audio>
                                </div>
                              </div>
                            );
                          } else {
                            // Intentar adivinar el nombre del archivo
                            const fileName = mediaUrl.split('/').pop()?.split('?')[0] || 'Archivo adjunto';
                            const isPdf = lowerUrl.includes('.pdf');

                            return (
                              <div className="mt-2 flex items-center gap-3 bg-muted/50 p-3 rounded-md border border-border max-w-full hover:bg-muted transition-colors">
                                <div className="bg-background p-2 rounded-md text-primary shadow-sm">
                                  {isPdf ? <FilePdf size={24} weight="duotone" /> : <FileIcon size={24} weight="duotone" />}
                                </div>
                                <div className="flex-1 min-w-0 overflow-hidden">
                                  <p className="text-sm font-medium truncate" title={fileName}>{fileName}</p>
                                  <a
                                    href={mediaUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                                  >
                                    Abrir en nueva pestaña
                                  </a>
                                </div>
                                <a
                                  href={mediaUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 hover:bg-background rounded-full transition-colors text-muted-foreground hover:text-foreground"
                                  title="Descargar"
                                  download
                                >
                                  <DownloadSimple size={20} />
                                </a>
                              </div>
                            )
                          }
                        }
                        return null;
                      })()}
                      <div className="flex justify-between items-center mt-1 opacity-70">
                        <span className="text-xs">{formatSafeDate(msg.timestamp, 'h:mm a')}</span>
                        {msg.sender === 'team' && (
                          (msg.metadata as any)?.error ? (
                            <WarningCircle className="w-3.5 h-3.5 text-red-500 ml-1" weight="fill" title="Error enviando a WhatsApp (404 Client not found)" />
                          ) : (
                            msg.read ? <Check size={14} weight="bold" className="text-blue-500 ml-1" /> : <Check size={14} className="ml-1" />
                          )
                        )}
                      </div>
                    </div>
                  ))}
                <div ref={messagesEndRef} />
                {leadMessages.filter(m => m.channel === selectedChannel).length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-8">
                    {t.chat.noMessages}
                  </p>
                )}
              </div>
            </ScrollArea>

            <div className="flex flex-wrap gap-1 sm:gap-2 items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  if (file.size > 16 * 1024 * 1024) {
                    toast.error('El archivo es muy grande. Máximo 16MB')
                    return
                  }
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
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }
                }}
                className="hidden"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={!canEdit || isUploading}
                title="Adjuntar archivo"
              >
                {isUploading ? <Spinner size={20} className="animate-spin" /> : <Paperclip size={20} />}
              </Button>
              <Input
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder={t.chat.typeMessage}
                onKeyDown={(e) => e.key === 'Enter' && !isUploading && sendMessage()}
                disabled={!canEdit || isUploading}
                className="flex-1 min-w-0"
              />
              <Button onClick={sendMessage} disabled={!canEdit || isUploading || isRecording}>
                <PaperPlaneRight size={20} />
              </Button>

              {/* Botón de grabar audio */}
              <Button
                variant={isRecording ? "destructive" : "ghost"}
                size="icon"
                disabled={!canEdit || isUploading}
                title={isRecording ? "Detener grabación" : "Grabar nota de voz"}
                onClick={() => {
                  if (isRecording) {
                    stopRecording()
                  } else {
                    startRecording()
                  }
                }}
              >
                {isRecording ? (
                  <Stop size={20} weight="fill" />
                ) : (
                  <Microphone size={20} />
                )}
              </Button>

              {/* Indicador de tiempo de grabación */}
              {isRecording && (
                <div className="flex items-center gap-2 text-destructive animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-destructive" />
                  <span className="text-sm font-mono">
                    {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:{(recordingTime % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              )}
            </div>
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

              {leadMeetings.map(meeting => {
                const participantNames = meeting.participants.map(participant => participant.name).filter(Boolean)
                const participantDisplay = participantNames.length > 0 ? participantNames.join(', ') : 'Sin participantes'

                return (
                  <div key={meeting.id} className="p-4 border border-border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium">{meeting.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {formatSafeDate(meeting.date, 'MMM d, yyyy h:mm a')} • {meeting.duration}min
                        </p>
                      </div>
                      {canEdit && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              disabled={deletingMeetingId === meeting.id}
                            >
                              <Trash size={16} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminar reunión</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción eliminará la reunión permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteMeeting(meeting.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                disabled={deletingMeetingId === meeting.id}
                              >
                                {deletingMeetingId === meeting.id ? 'Eliminando…' : 'Eliminar'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                    <p className="text-sm mt-2">{meeting.notes}</p>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {t.meeting.participants}: {participantDisplay}
                    </div>
                  </div>
                )
              })}

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
                  <div key={note.id} className="p-3 border border-border rounded-lg overflow-hidden">
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-sm flex-1 min-w-0 break-all whitespace-pre-wrap overflow-hidden">{note.content}</p>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteNote(note.id)}
                          title="Eliminar nota"
                        >
                          <Trash size={14} />
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                      <span>{note.createdBy}</span>
                      <span>{formatSafeDate(note.createdAt, 'MMM d, yyyy h:mm a')}</span>
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
        teamMembers={teamMembers}
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
