import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Lead } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { MagnifyingGlass, WhatsappLogo, InstagramLogo, PaperPlaneRight, Paperclip, Microphone, Smiley, Check, ChatCircleDots, DownloadSimple, FilePdf, File as FileIcon, Spinner, Stop, X, CaretRight, VideoCamera, Phone, Info, ArrowLeft, WarningCircle, PencilSimple, ArrowSquareOut, Archive, Gear, Trash, CaretLeft } from '@phosphor-icons/react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { LeadDetailSheet } from './LeadDetailSheet'
import { getMessages, sendMessage, subscribeToMessages, subscribeToAllMessages, getUnreadMessagesCount, markMessagesAsRead, uploadChatAttachment } from '@/supabase/services/mensajes'
import type { Message as DbMessage } from '@/supabase/services/mensajes'
import { toast } from 'sonner'
import { ChatSettingsDialog } from './ChatSettingsDialog'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useLeadsList } from '@/hooks/useLeadsList'

interface ChatsViewProps {
  companyId: string
  onNavigateToPipeline?: (leadId: string) => void
  canDeleteLead?: boolean
}

// Helper para formatear fechas de forma segura en este componente
const safeFormat = (date: Date | string | undefined | null, fmt: string, options?: any) => {
  if (!date) return ''
  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return ''
    return format(d, fmt, options)
  } catch (e) {
    return ''
  }
}

export function ChatsView({ companyId, onNavigateToPipeline, canDeleteLead = false }: ChatsViewProps) {
  // ==========================================
  // Hook de leads paginados (antes era ~250 líneas de código duplicado)
  // ==========================================
  const {
    leads,
    isInitialLoading,
    isFetchingMore,
    loadError,
    hasMore,
    unreadCounts,
    channelByLead: lastChannelByLead,
    chatScope,
    setScope: handleScopeChange,
    refresh: loadLeads,
    loadMore: fetchMoreLeads,
    updateLead: handleLeadUpdate,
    toggleArchive,
    removeLead,
    updateLeadOrder: updateLeadListOrder,
    updateUnreadCount
  } = useLeadsList({ companyId })

  // Estados UI locales (no relacionados con datos de leads)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [showContactInfo, setShowContactInfo] = useState(false)
  const [detailSheetOpen, setDetailSheetOpen] = useState(false)
  const [messages, setMessages] = useState<DbMessage[]>([])
  const [channelFilter, setChannelFilter] = useState<'all' | 'whatsapp' | 'instagram'>('all')
  const [unreadFilter, setUnreadFilter] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [messageInput, setMessageInput] = useState('')
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [archivingLeadId, setArchivingLeadId] = useState<string | null>(null)
  const [showChatSettings, setShowChatSettings] = useState(false)
  const listParentRef = useRef<HTMLDivElement | null>(null)

  const [pendingImages, setPendingImages] = useState<Array<{ file: File; preview: string }>>([])
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  const filterScrollRef = useRef<HTMLDivElement | null>(null)

  const [isUploading, setIsUploading] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Hook de grabación de audio
  const handleAudioReady = useCallback(async (audioBlob: Blob, audioFile: File) => {
    if (!selectedLeadId) return
    setIsUploading(true)
    try {
      const mediaData = await uploadChatAttachment(audioFile, selectedLeadId)
      const channel = lastChannelByLead[selectedLeadId] || 'whatsapp'
      await sendMessage(selectedLeadId, '', 'team', channel, mediaData)
      toast.success('Nota de voz enviada')
    } catch (err) {
      console.error('[Audio] Error sending:', err)
      toast.error('Error enviando nota de voz')
    } finally {
      setIsUploading(false)
    }
  }, [selectedLeadId, lastChannelByLead])

  const { isRecording, recordingTime, startRecording, stopRecording } = useAudioRecorder({
    onAudioReady: handleAudioReady,
    onError: (error) => toast.error(error.message || 'No se pudo acceder al micrófono')
  })


  // ==========================================
  // NOTA: Toda la lógica de loadLeads, fetchMoreLeads, loadUnreadCountsInBatches,
  // loadLastMessagesInBackground y handleScopeChange ahora viene del hook useLeadsList.
  // Se eliminaron ~280 líneas de código duplicado.
  // ==========================================

  // Scroll automático a nuevos mensajes
  useEffect(() => {
    const el = document.getElementById('chat-scroll-area')
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, selectedLeadId])

  const sortedLeads = useMemo(() => {
    let filtered = leads
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      filtered = filtered.filter(l => (l.name || '').toLowerCase().includes(q) || (l.phone || '').toLowerCase().includes(q))
    }
    if (unreadFilter) filtered = filtered.filter(l => (unreadCounts[l.id] || 0) > 0)
    if (channelFilter !== 'all') filtered = filtered.filter(l => (lastChannelByLead[l.id] || 'whatsapp') === channelFilter)
    return filtered.sort((a, b) => {
      // Priorizar chats con mensajes no leídos
      const unreadA = (unreadCounts[a.id] || 0) > 0 ? 1 : 0
      const unreadB = (unreadCounts[b.id] || 0) > 0 ? 1 : 0
      if (unreadA !== unreadB) return unreadB - unreadA

      // Luego ordenar por fecha del último mensaje
      const dateA = (a.lastMessageAt ? new Date(a.lastMessageAt) : a.createdAt || new Date(0)).getTime()
      const dateB = (b.lastMessageAt ? new Date(b.lastMessageAt) : b.createdAt || new Date(0)).getTime()
      return dateB - dateA
    })
  }, [leads, searchTerm, channelFilter, unreadFilter, lastChannelByLead, unreadCounts])

  const rowVirtualizer = useVirtualizer({
    count: sortedLeads.length,
    getScrollElement: () => listParentRef.current,
    estimateSize: () => 72,
    overscan: 8
  })

  // Cargar más leads al llegar al final de la lista (paginación infinita)
  useEffect(() => {
    const items = rowVirtualizer.getVirtualItems()
    const last = items[items.length - 1]
    if (!last) return
    if (last.index >= sortedLeads.length - 10) fetchMoreLeads()
  }, [rowVirtualizer.getVirtualItems(), sortedLeads.length, fetchMoreLeads])

  // Cargar mensajes cuando se selecciona un lead
  useEffect(() => {
    if (!selectedLeadId) return
    const load = async () => {
      setIsLoadingMessages(true)
      try { setMessages(await getMessages(selectedLeadId)) } catch (e) { console.error('Error loading messages:', e) } finally { setIsLoadingMessages(false) }
    }
    void load()
      ; (async () => { try { await markMessagesAsRead(selectedLeadId); updateUnreadCount(selectedLeadId, 0) } catch { } })()

    const sub = subscribeToMessages(selectedLeadId, (newMsg) => {
      setMessages(prev => [...prev, newMsg])
      updateLeadListOrder(selectedLeadId, newMsg)
      if (newMsg.sender === 'lead') { (async () => { try { await markMessagesAsRead(selectedLeadId); updateUnreadCount(selectedLeadId, 0) } catch { } })() }
    })
    return () => { try { sub.unsubscribe() } catch { } }
  }, [selectedLeadId, updateLeadListOrder, updateUnreadCount])

  // Suscripción global a mensajes para actualizar lista
  useEffect(() => {
    if (leads.length === 0) return
    const ch = subscribeToAllMessages((msg) => {
      updateLeadListOrder(msg.lead_id, msg)
      if (msg.sender === 'lead') {
        if (selectedLeadId !== msg.lead_id) {
          // Incrementar contador de no leídos
          const currentCount = unreadCounts[msg.lead_id] || 0
          updateUnreadCount(msg.lead_id, currentCount + 1)
        }
      } else {
        // Respuesta del equipo/IA: actualizar desde servidor
        setTimeout(async () => {
          try {
            const counts = await getUnreadMessagesCount([msg.lead_id])
            updateUnreadCount(msg.lead_id, counts[msg.lead_id] ?? 0)
          } catch { }
        }, 1000)
      }
    })
    return () => { try { ch.unsubscribe() } catch { } }
  }, [leads.length, selectedLeadId, updateLeadListOrder, updateUnreadCount, unreadCounts])

  // Handlers para archivar/eliminar leads (ahora usan funciones del hook)
  async function handleArchiveToggle(lead: Lead | undefined, nextState: boolean) {
    if (!lead) return
    setArchivingLeadId(lead.id)
    try {
      await toggleArchive(lead, nextState)
      if (selectedLeadId === lead.id && ((nextState && chatScope === 'active') || (!nextState && chatScope === 'archived'))) {
        setSelectedLeadId(null)
        setMessages([])
      }
    } catch (err) {
      // Error handling done in hook
    } finally {
      setArchivingLeadId(null)
    }
  }

  async function handleDeleteLead(lead: Lead | undefined) {
    if (!lead) return
    const confirmed = window.confirm(`¿Eliminar el lead "${lead.name || lead.phone || lead.id}"? Esta acción no se puede deshacer.`)
    if (!confirmed) return
    try {
      await removeLead(lead.id)
      if (selectedLeadId === lead.id) {
        setSelectedLeadId(null)
        setMessages([])
      }
    } catch (err) {
      // Error handling done in hook
    }
  }


  // NOTA: startRecording y stopRecording ahora vienen del hook useAudioRecorder
  // Se eliminaron ~90 líneas de código duplicado

  const removePendingImage = (preview: string) => {
    setPendingImages(prev => {
      const next = prev.filter(p => p.preview !== preview)
      URL.revokeObjectURL(preview)
      return next
    })
  }

  const clearPendingImages = () => {
    setPendingImages(prev => {
      prev.forEach(p => URL.revokeObjectURL(p.preview))
      return []
    })
  }

  const handlePasteClipboard = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (!selectedLeadId) return
    const items = Array.from(e.clipboardData?.items || [])
    const images = items.filter(item => item.type.startsWith('image/')).map(i => i.getAsFile()).filter(Boolean) as File[]
    if (!images.length) return

    e.preventDefault()
    const validImages = images.filter(file => file.size <= 16 * 1024 * 1024)
    if (validImages.length !== images.length) {
      toast.error('Alguna imagen supera 16MB y fue descartada')
    }
    if (!validImages.length) return

    const mapped = validImages.map(file => ({ file, preview: URL.createObjectURL(file) }))
    setPendingImages(prev => [...prev, ...mapped])
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedLeadId) return
    if (!messageInput.trim() && pendingImages.length === 0) return
    setIsUploading(true)
    try {
      const channel = lastChannelByLead[selectedLeadId] || 'whatsapp'

      if (pendingImages.length > 0) {
        for (let i = 0; i < pendingImages.length; i++) {
          const { file } = pendingImages[i]
          const mediaData = await uploadChatAttachment(file, selectedLeadId)
          const content = i === 0 ? messageInput : ''
          await sendMessage(selectedLeadId, content, 'team', channel, mediaData)
        }
      } else {
        const content = messageInput
        await sendMessage(selectedLeadId, content, 'team', channel)
        setLeads(prev => prev.map(l => l.id === selectedLeadId ? { ...l, lastMessageAt: new Date(), lastMessageSender: 'team', lastMessage: content } : l))
        setLastChannelByLead(prev => ({ ...prev, [selectedLeadId]: channel }))
      }

      setMessageInput('')
      clearPendingImages()
    } catch (e) {
      console.error('Error sending message:', e)
      toast.error('Error al enviar mensaje')
    } finally {
      setIsUploading(false)
    }
  }

  const selectedLead = leads.find(l => l.id === selectedLeadId)

  const chatMedia = useMemo(() => {
    if (!messages.length) return []
    return messages.filter(m => {
      const data = m.metadata?.data || m.metadata || {};
      const type = data.type;
      // Check metadata type
      if (type === 'image' || type === 'video') return true;

      // Check media object in metadata
      if (data.mediaUrl || data.media?.url || data.body?.startsWith('http')) {
        const url = data.mediaUrl || data.media?.url || data.body;
        if (!url) return false;
        const lower = url.toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.mov'].some(ext => lower.includes(ext));
      }

      // Check content for URLs
      if (m.content && (m.content.match(/https?:\/\/.*\.(jpg|jpeg|png|gif|webp|mp4|webm|mov)/i))) return true;
      return false;
    }).map(m => {
      const data = m.metadata?.data || m.metadata || {};
      let url = data.mediaUrl || data.media?.url || (data.type === 'image' && data.body?.startsWith('http') ? data.body : null);

      if (!url && m.content) {
        const match = m.content.match(/(https?:\/\/[^\s]+)/g);
        if (match) {
          const found = match.find(u => ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.mov'].some(ext => u.toLowerCase().includes(ext)));
          if (found) url = found;
        }
      }

      let type = data.type;
      if (!type && url) {
        type = ['.mp4', '.webm', '.mov'].some(ext => url!.toLowerCase().includes(ext)) ? 'video' : 'image';
      }

      return { id: m.id, url, type };
    }).filter(m => m.url).reverse();
  }, [messages]);

  return (
    <div className="flex flex-1 min-h-0 bg-background rounded-tl-2xl border-t border-l shadow-sm overflow-hidden w-full">
      <div className={cn("flex flex-col border-r bg-muted/10 h-full w-full md:w-96 shrink-0 transition-all duration-300", selectedLeadId ? "hidden md:flex" : "flex")}>
        <div className="p-6 space-y-4 bg-background border-b shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <ChatCircleDots size={20} className="text-primary" weight="fill" />
              </div>
              <h2 className="font-bold text-xl tracking-tight">Chats</h2>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="bg-muted text-muted-foreground font-bold px-2 rounded-md">
                {sortedLeads.length}
              </Badge>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted" onClick={() => setShowChatSettings(true)} title="Configuración">
                <Gear className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          </div>

          <div className="relative group">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Buscar conversación..."
              className="pl-9 h-10 bg-muted/40 border-none rounded-xl focus-visible:ring-1 focus-visible:ring-primary/30 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="relative group">
            <div
              ref={filterScrollRef}
              className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent pr-12"
            >
              <button
                onClick={() => handleScopeChange('active')}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border shrink-0",
                  chatScope === 'active'
                    ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                    : "bg-background text-muted-foreground border-border hover:bg-muted hover:border-muted-foreground/30"
                )}
              >
                Activos
              </button>
              <button
                onClick={() => handleScopeChange('archived')}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border shrink-0",
                  chatScope === 'archived'
                    ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                    : "bg-background text-muted-foreground border-border hover:bg-muted hover:border-muted-foreground/30"
                )}
              >
                Archivados
              </button>
              <div className="w-px h-4 bg-border mx-1 shrink-0" />
              <button
                onClick={() => { setUnreadFilter(false); setChannelFilter('all'); setSearchTerm(''); handleScopeChange('active') }}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border shrink-0",
                  !unreadFilter && channelFilter === 'all'
                    ? "bg-zinc-900 text-white border-zinc-900 shadow-md shadow-black/10"
                    : "bg-background text-muted-foreground border-border hover:bg-muted hover:border-muted-foreground/30"
                )}
              >
                Todos
              </button>
              <button
                onClick={() => { setUnreadFilter(!unreadFilter); handleScopeChange('active') }}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border shrink-0",
                  unreadFilter
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20"
                    : "bg-background text-muted-foreground border-border hover:bg-muted hover:border-muted-foreground/30"
                )}
              >
                No leídos
              </button>
              <button
                onClick={() => { setChannelFilter(channelFilter === 'whatsapp' ? 'all' : 'whatsapp'); handleScopeChange('active') }}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 border shrink-0",
                  channelFilter === 'whatsapp'
                    ? "bg-[#25D366] text-white border-[#25D366] shadow-md shadow-[#25D366]/20"
                    : "bg-background text-muted-foreground border-border hover:bg-muted hover:border-muted-foreground/30"
                )}
              >
                <WhatsappLogo weight="fill" className="h-3.5 w-3.5" />
                WhatsApp
              </button>
              <button
                onClick={() => { setChannelFilter(channelFilter === 'instagram' ? 'all' : 'instagram'); handleScopeChange('active') }}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 border shrink-0",
                  channelFilter === 'instagram'
                    ? "bg-[#E1306C] text-white border-[#E1306C] shadow-md shadow-[#E1306C]/20"
                    : "bg-background text-muted-foreground border-border hover:bg-muted hover:border-muted-foreground/30"
                )}
              >
                <InstagramLogo weight="fill" className="h-3.5 w-3.5" />
                Instagram
              </button>
            </div>
            <div className="hidden md:flex absolute inset-y-0 right-1 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                className="h-8 w-8 flex items-center justify-center rounded-full bg-background shadow-sm border border-border/60 text-muted-foreground hover:text-foreground hover:shadow-md transition-all active:scale-95"
                onClick={() => filterScrollRef.current?.scrollBy({ left: -140, behavior: 'smooth' })}
                aria-label="Desplazar filtros a la izquierda"
              >
                <CaretLeft size={16} weight="bold" />
              </button>
              <button
                type="button"
                className="h-8 w-8 flex items-center justify-center rounded-full bg-background shadow-sm border border-border/60 text-muted-foreground hover:text-foreground hover:shadow-md transition-all active:scale-95"
                onClick={() => filterScrollRef.current?.scrollBy({ left: 140, behavior: 'smooth' })}
                aria-label="Desplazar filtros a la derecha"
              >
                <CaretRight size={16} weight="bold" />
              </button>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto" ref={listParentRef}>
          {/* Estado de carga inicial */}
          {isInitialLoading && (
            <div className="flex flex-col items-center justify-center p-8 gap-3">
              <Spinner className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Cargando chats...</p>
              <p className="text-xs text-muted-foreground/70">Empresa: {companyId?.slice(0, 8)}...</p>
            </div>
          )}

          {/* Estado de error */}
          {loadError && !isInitialLoading && (
            <div className="flex flex-col items-center justify-center p-8 gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <X className="w-6 h-6 text-destructive" />
              </div>
              <p className="text-sm font-medium text-destructive">Error al cargar chats</p>
              <p className="text-xs text-muted-foreground max-w-xs">{loadError}</p>
              <Button variant="outline" size="sm" onClick={() => loadLeads({ scope: chatScope, forceRefresh: true })}>
                Reintentar
              </Button>
            </div>
          )}

          {/* Lista de chats */}
          {!isInitialLoading && !loadError && (
            <div className="relative w-full" style={{ height: rowVirtualizer.getTotalSize() }}>
              <div className="absolute top-0 left-0 w-full" style={{ transform: `translateY(${rowVirtualizer.getVirtualItems()[0]?.start || 0}px)` }}>
                {rowVirtualizer.getVirtualItems().map(vi => {
                  const lead = sortedLeads[vi.index]; if (!lead) return null
                  return (
                    <button
                      key={lead.id}
                      onClick={() => setSelectedLeadId(lead.id)}
                      className={cn(
                        "flex items-center gap-4 px-4 py-3 text-left transition-all duration-200 border-b border-border/40 h-full w-full group relative",
                        selectedLeadId === lead.id
                          ? "bg-primary/10"
                          : "hover:bg-muted/50"
                      )}
                      style={{ height: vi.size }}
                    >
                      {selectedLeadId === lead.id && (
                        <div className="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-r-full" />
                      )}

                      <div className="relative shrink-0">
                        <Avatar className="h-12 w-12 border-2 border-background shadow-sm ring-1 ring-border/50 group-hover:scale-105 transition-transform duration-200">
                          <AvatarImage src={lead.avatar} />
                          <AvatarFallback className="bg-muted text-muted-foreground font-bold">{(lead.name || 'Unknown').substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 shadow-sm border border-background">
                          {lastChannelByLead[lead.id] === 'instagram' ? (<InstagramLogo weight="fill" className="h-3.5 w-3.5 text-[#E1306C]" />) : (<WhatsappLogo weight="fill" className="h-3.5 w-3.5 text-[#25D366]" />)}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-center h-full gap-0.5">
                        <div className="flex justify-between items-baseline">
                          <span className={cn(
                            "truncate text-[15px] leading-none transition-colors",
                            unreadCounts[lead.id] > 0 ? "font-bold text-foreground" : "font-semibold text-foreground/80 group-hover:text-foreground"
                          )}>
                            {lead.name}
                          </span>
                          <span className={cn(
                            "text-[10px] uppercase tracking-tighter whitespace-nowrap ml-2 font-bold",
                            unreadCounts[lead.id] > 0 ? "text-emerald-500" : "text-muted-foreground"
                          )}>
                            {safeFormat(lead.lastMessageAt, 'HH:mm', { locale: es })}
                          </span>
                        </div>

                        <div className="flex justify-between items-center gap-2">
                          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                            {lead.lastMessageSender === 'team' && <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" weight="bold" />}
                            <p className={cn(
                              "text-sm truncate leading-tight transition-colors",
                              lead.lastMessageSender === 'lead' && unreadCounts[lead.id] > 0
                                ? "font-bold text-foreground/90"
                                : "text-muted-foreground group-hover:text-muted-foreground/80"
                            )}>
                              {lead.lastMessage || 'Sin mensaje reciente'}
                            </p>
                          </div>

                          {unreadCounts[lead.id] > 0 && (
                            <span className="min-w-[1.25rem] h-5 flex items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-black px-1.5 shrink-0 shadow-lg shadow-emerald-500/20 animate-in zoom-in duration-300">
                              {unreadCounts[lead.id]}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
                {sortedLeads.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground hover:text-foreground transition-colors">
                    {chatScope === 'archived' ? 'No hay chats archivados' : 'No hay chats encontrados'}
                  </div>
                )}
                {isFetchingMore && (<div className="p-4 text-center text-muted-foreground flex items-center justify-center gap-2"><Spinner className="w-4 h-4 animate-spin" /> Cargando más...</div>)}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className={cn("flex-1 flex flex-row relative h-full overflow-hidden bg-[#efeae2] dark:bg-background/95", !selectedLeadId ? "hidden md:flex" : "flex")}>
        {selectedLead ? (
          <>
            <div className="flex-1 flex flex-col h-full min-w-0 relative transition-all duration-300">
              {/* Header de conversación */}
              <div
                className="h-16 px-4 border-b bg-background flex items-center justify-between shrink-0 cursor-pointer hover:bg-muted/30 transition-colors group"
                onClick={() => setShowContactInfo(!showContactInfo)}
              >
                <div className="flex items-center gap-3 min-w-0 overflow-hidden">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden shrink-0 -ml-2 mr-1 h-10 w-10 text-muted-foreground hover:text-foreground"
                    onClick={(e) => { e.stopPropagation(); setSelectedLeadId(null); }}
                  >
                    <ArrowLeft className="w-6 h-6" />
                  </Button>
                  <Avatar className="h-10 w-10 shadow-sm border border-border/50 shrink-0">
                    <AvatarImage src={selectedLead.avatar} />
                    <AvatarFallback className="bg-muted text-muted-foreground font-bold">
                      {(selectedLead.name || 'Unknown').substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <h3 className="font-bold truncate text-sm sm:text-base leading-tight tracking-tight">
                      {selectedLead.name}
                    </h3>
                    <div className="flex items-center text-[11px] font-medium text-muted-foreground min-w-0">
                      <span className="whitespace-nowrap flex-shrink-0">{selectedLead.phone}</span>
                      {selectedLead.company && (
                        <>
                          <span className="mx-1.5 flex-shrink-0 opacity-50">•</span>
                          <span className="truncate min-w-0">{selectedLead.company}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
                  <button
                    type="button"
                    className="p-2 rounded-full hover:bg-muted transition-all active:scale-95"
                    onClick={(e) => { e.stopPropagation(); /* TODO: Implement search */ }}
                  >
                    <MagnifyingGlass className="w-5 h-5" />
                  </button>
                  <div className="h-4 w-px bg-border/60 mx-1 hidden sm:block" />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowContactInfo(!showContactInfo); }}
                    className={cn(
                      "p-2 rounded-full hover:bg-muted transition-all active:scale-95",
                      showContactInfo ? "bg-primary/10 text-primary" : ""
                    )}
                  >
                    <Info className="w-5 h-5" weight={showContactInfo ? "fill" : "regular"} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin scrollbar-thumb-muted-foreground/10" id="chat-scroll-area">
                <div className="space-y-6 max-w-3xl mx-auto pb-4">
                  {messages.map((msg, idx) => {
                    const isTeam = msg.sender === 'team'
                    const msgDate = safeFormat(msg.created_at, 'yyyy-MM-dd')
                    const prevMsgDate = idx > 0 ? safeFormat(messages[idx - 1].created_at, 'yyyy-MM-dd') : null
                    const showDateLabel = msgDate !== prevMsgDate

                    const data = msg.metadata?.data || msg.metadata || {};
                    let mediaUrl = data.mediaUrl || data.media?.links?.download || data.media?.url || data.media?.publicUrl || data.media?.downloadUrl || (data.type === 'image' && data.body?.startsWith('http') ? data.body : null);

                    if (!mediaUrl && msg.content) {
                      const urlRegex = /(https?:\/\/[^\s]+)/g;
                      const matches = msg.content.match(urlRegex);
                      if (matches) {
                        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.pdf', '.csv'];
                        const foundUrl = matches.find(url => {
                          const lower = url.toLowerCase();
                          return imageExtensions.some(ext => lower.includes(ext));
                        }) || matches[matches.length - 1];
                        if (foundUrl) mediaUrl = foundUrl;
                      }
                    }

                    return (
                      <div key={msg.id || idx} className="contents">
                        {showDateLabel && (
                          <div className="flex justify-center my-8">
                            <span className="px-4 py-1.5 bg-background/80 backdrop-blur-md border border-border/40 text-[10px] font-black text-muted-foreground rounded-full uppercase tracking-widest shadow-sm z-10">
                              {safeFormat(msg.created_at, "EEEE, d 'de' MMMM", { locale: es })}
                            </span>
                          </div>
                        )}
                        <div className={cn("flex w-full group/msg", isTeam ? "justify-end" : "justify-start")}>
                          <div className={cn(
                            "max-w-[85%] sm:max-w-[70%] px-3.5 py-2.5 rounded-2xl shadow-sm text-[15px] relative animate-in fade-in slide-in-from-bottom-2 duration-300",
                            isTeam
                              ? "bg-primary text-primary-foreground rounded-tr-none shadow-primary/10"
                              : "bg-white text-black rounded-tl-none border border-border/10 shadow-black/5"
                          )}>

                            {(() => {
                              if (!msg.content) return null;
                              if (msg.content.startsWith('http')) return null;

                              if (mediaUrl) {
                                const urlRegex = /https?:\/\/[^\s]+/gi;
                                const cleanedContent = msg.content.replace(urlRegex, '').trim();
                                if (cleanedContent && cleanedContent.length > 0) {
                                  return <div className="whitespace-pre-wrap leading-relaxed mb-2 font-medium">{cleanedContent}</div>;
                                }
                                return null;
                              }
                              return <div className="whitespace-pre-wrap leading-relaxed font-medium">{msg.content}</div>;
                            })()}

                            {(() => {
                              if (!mediaUrl) return null;
                              const lowerUrl = mediaUrl.toLowerCase();
                              const mimeType = data.media?.mimeType || data.media?.type || data.media?.contentType || data.type
                              const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].some(ext => lowerUrl.includes(ext))
                                || (mimeType && mimeType.toLowerCase().startsWith('image/'))
                                || (data.type === 'image')
                              const isVideo = ['.mp4', '.webm', '.ogg', '.mov'].some(ext => lowerUrl.includes(ext))
                                || (mimeType && mimeType.toLowerCase().startsWith('video/'))
                                || (data.type === 'video')
                              const isAudio = ['.mp3', '.wav', '.ogg', '.oga', '.m4a', '.aac', '.opus'].some(ext => lowerUrl.includes(ext))
                                || (mimeType && mimeType.toLowerCase().startsWith('audio/'))
                                || (data.type === 'audio')
                                || (data.type === 'ptt');

                              if (isImage) {
                                return (
                                  <button
                                    type="button"
                                    className="mt-1 rounded-xl overflow-hidden shadow-inner bg-black/5 ring-1 ring-black/5 dark:ring-white/5 cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-primary/40"
                                    onClick={() => mediaUrl && setLightboxImage(mediaUrl)}
                                    onKeyDown={(ev) => { if ((ev.key === 'Enter' || ev.key === ' ') && mediaUrl) { ev.preventDefault(); setLightboxImage(mediaUrl) } }}
                                  >
                                    <img
                                      src={mediaUrl}
                                      alt="Imagen"
                                      className="max-w-full h-auto object-cover max-h-[500px] hover:scale-[1.01] transition-transform duration-500"
                                      loading="lazy"
                                    />
                                  </button>
                                );
                              } else if (isVideo) {
                                return (
                                  <div className="mt-1 rounded-xl overflow-hidden shadow-inner bg-black/5 ring-1 ring-black/5 dark:ring-white/5">
                                    <video src={mediaUrl} controls className="max-w-full h-auto max-h-[500px]" />
                                  </div>
                                );
                              } else if (isAudio) {

                                {
                                  lightboxImage && (
                                    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setLightboxImage(null)}>
                                      <div className="relative max-w-6xl max-h-[90vh] w-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                                        <img src={lightboxImage} alt="Imagen ampliada" className="max-h-[90vh] max-w-full rounded-2xl shadow-2xl" />
                                        <button
                                          type="button"
                                          className="absolute top-3 right-3 bg-black/70 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-black"
                                          onClick={() => setLightboxImage(null)}
                                        >
                                          ×
                                        </button>
                                      </div>
                                    </div>
                                  )
                                }
                                return (
                                  <div className={cn("mt-1 flex items-center gap-3 p-2 rounded-xl border max-w-full backdrop-blur-sm", isTeam ? "bg-white/10 border-white/10" : "bg-muted/30 border-border/30")}>
                                    <div className={cn("p-2 rounded-full text-white shrink-0 shadow-sm", isTeam ? "bg-white/20" : "bg-primary")}>
                                      <Microphone size={16} weight="fill" />
                                    </div>
                                    <div className="flex-1 min-w-[150px]">
                                      <audio src={mediaUrl} controls className={cn("w-full h-8 opacity-90", isTeam ? "invert grayscale" : "")} />
                                    </div>
                                  </div>
                                );
                              } else {
                                const fileName = mediaUrl.split('/').pop()?.split('?')[0] || 'Archivo adjunto';
                                return (
                                  <div className={cn("mt-1 flex items-center gap-3 p-3 rounded-xl border max-w-full transition-all cursor-pointer", isTeam ? "bg-white/10 border-white/10 hover:bg-white/20" : "bg-muted/30 border-border/30 hover:bg-muted")}>
                                    <div className={cn("p-2.5 rounded-lg shadow-sm shrink-0", isTeam ? "bg-white/10 text-white" : "bg-background text-primary")}>
                                      <FileIcon size={24} weight="duotone" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-bold truncate" title={fileName}>{fileName}</p>
                                      <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className={cn("text-[10px] font-black uppercase tracking-tight hover:underline flex items-center gap-1 mt-1 opacity-80", isTeam ? "text-white" : "text-primary")}>Descargar</a>
                                    </div>
                                  </div>
                                )
                              }
                            })()}

                            <div className={cn("text-[10px] mt-1.5 flex items-center gap-1.5 font-bold tracking-tight uppercase opacity-60", isTeam ? "justify-end text-white/90" : "justify-start text-muted-foreground/90")}>
                              {safeFormat(msg.created_at, 'HH:mm')}
                              {isTeam && (
                                (msg.metadata as any)?.error ? (
                                  <WarningCircle className="w-3.5 h-3.5 text-red-300" weight="fill" />
                                ) : (
                                  msg.read
                                    ? <Check className="w-3.5 h-3.5 text-white" weight="bold" />
                                    : <div className="flex items-center -space-x-1.5">
                                      <Check className="w-3 h-3" />
                                      <Check className="w-3 h-3" />
                                    </div>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  <div ref={messagesEndRef} id="scroll-bottom" />
                </div>
              </div>
              {/* Barra de entrada de mensaje */}
              <div className="p-4 bg-background border-t shrink-0">
                <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-3 items-end relative">
                  {pendingImages.length > 0 && (
                    <div className="absolute -top-28 left-0 right-0 flex gap-2 overflow-x-auto pb-2">
                      {pendingImages.map(img => (
                        <div key={img.preview} className="relative w-24 h-24 rounded-xl overflow-hidden border border-border shadow-sm">
                          <img src={img.preview} alt="Pegado" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-black"
                            onClick={() => removePendingImage(img.preview)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file || !selectedLeadId) return
                      if (file.size > 16 * 1024 * 1024) {
                        toast.error('El archivo es muy grande. Máximo 16MB')
                        return
                      }
                      setIsUploading(true)
                      try {
                        const mediaData = await uploadChatAttachment(file, selectedLeadId)
                        const channel = lastChannelByLead[selectedLeadId] || 'whatsapp'
                        await sendMessage(selectedLeadId, messageInput || '', 'team', channel, mediaData)
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
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="rounded-full h-11 w-11 text-muted-foreground hover:bg-muted active:scale-90 transition-all"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? <Spinner size={20} className="animate-spin" /> : <Paperclip className="w-5 h-5" />}
                  </Button>
                  <div className="flex-1 bg-muted/50 border border-border/50 rounded-2xl px-4 py-2.5 flex items-center gap-2 focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-300">
                    <input
                      className="flex-1 bg-transparent border-none focus:outline-none text-sm min-h-[24px] font-medium"
                      placeholder={isRecording ? "Grabando... pulsa detener para enviar" : "Escribe un mensaje aquí..."}
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onPaste={handlePasteClipboard}
                      disabled={isUploading || isRecording}
                    />
                    {!isRecording && !messageInput.trim() && (
                      <button type="button" className="text-muted-foreground hover:text-primary transition-colors p-1">
                        <Smiley className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  {messageInput.trim() ? (
                    <Button
                      type="submit"
                      size="icon"
                      className="rounded-full h-11 w-11 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-90 transition-all"
                      disabled={isUploading || isRecording}
                    >
                      <PaperPlaneRight className="w-5 h-5 text-white" weight="fill" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="icon"
                      variant={isRecording ? "destructive" : "ghost"}
                      className={cn(
                        "rounded-full h-11 w-11 transition-all active:scale-90",
                        isRecording ? "bg-destructive text-white hover:bg-destructive/90 animate-pulse" : "text-muted-foreground hover:bg-muted"
                      )}
                      disabled={isUploading}
                      onClick={() => isRecording ? stopRecording() : startRecording()}
                    >
                      {isRecording ? <Stop className="w-5 h-5" weight="fill" /> : <Microphone className="w-5 h-5" />}
                    </Button>
                  )}
                  {isRecording && (
                    <div className="absolute left-1/2 -top-16 -translate-x-1/2 bg-background border border-border/50 px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-3 text-destructive animate-in slide-in-from-bottom-2 z-50">
                      <div className="w-3 h-3 rounded-full bg-destructive animate-ping" />
                      <span className="text-sm font-black font-mono tracking-widest">
                        {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:{(recordingTime % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  )}
                </form>
              </div>
            </div>

            {/* Panel de información de contacto (Derecha) */}
            {showContactInfo && (
              <div className={cn(
                "h-full flex flex-col shrink-0 animate-in slide-in-from-right duration-300 shadow-2xl overflow-hidden z-20 bg-background border-l border-border",
                "absolute inset-0 w-full md:static md:w-[360px]"
              )}>
                <div className="h-16 px-4 bg-muted/10 border-b flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setShowContactInfo(false)} className="hover:bg-muted p-2 rounded-full transition-colors text-muted-foreground hover:text-foreground md:hidden">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <span className="font-bold text-xs uppercase tracking-[0.2em] text-muted-foreground/80">Información</span>
                  </div>
                  <button onClick={() => setShowContactInfo(false)} className="hover:bg-muted p-2 rounded-full transition-colors text-muted-foreground hover:text-foreground hidden md:block">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-none">
                  <div className="flex flex-col items-center p-8 pb-8 bg-gradient-to-b from-muted/20 to-transparent border-b border-border/40">
                    <div className="relative mb-6 group">
                      <Avatar className="w-32 h-32 shadow-2xl ring-4 ring-background group-hover:scale-105 transition-transform duration-500">
                        <AvatarImage src={selectedLead.avatar} />
                        <AvatarFallback className="text-4xl font-black bg-muted text-muted-foreground">
                          {(selectedLead.name || '?').substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-2 -right-2 bg-background rounded-full p-2 shadow-xl border border-border/20">
                        {lastChannelByLead[selectedLead.id] === 'instagram'
                          ? (<InstagramLogo weight="fill" className="h-6 w-6 text-[#E1306C]" />)
                          : (<WhatsappLogo weight="fill" className="h-6 w-6 text-[#25D366]" />)}
                      </div>
                    </div>

                    <h2 className="text-2xl font-black text-center text-foreground tracking-tight px-4 line-clamp-2">{selectedLead.name}</h2>
                    <p className="text-muted-foreground mt-1.5 text-sm font-bold tracking-wide">{selectedLead.phone}</p>

                    <div className="grid grid-cols-2 gap-2 mt-8 w-full px-4">
                      <Button variant="outline" size="sm" className="h-10 rounded-xl font-bold border-border/60 hover:bg-muted transition-all" onClick={() => setDetailSheetOpen(true)}>
                        <PencilSimple size={18} className="mr-2" />
                        Editar
                      </Button>
                      <Button variant="outline" size="sm" className="h-10 rounded-xl font-bold border-border/60 hover:bg-muted transition-all" onClick={() => onNavigateToPipeline?.(selectedLead.id)}>
                        <ArrowSquareOut size={18} className="mr-2" />
                        Pipeline
                      </Button>
                      <Button
                        variant={selectedLead.archived ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          "h-10 rounded-xl font-bold transition-all",
                          selectedLead.archived ? "bg-primary" : "border-border/60 hover:bg-muted"
                        )}
                        onClick={() => handleArchiveToggle(selectedLead, !selectedLead.archived)}
                        disabled={archivingLeadId === selectedLead.id}
                      >
                        {archivingLeadId === selectedLead.id ? (
                          <Spinner className="w-4 h-4 animate-spin" />
                        ) : (
                          <Archive size={18} className="mr-2" weight={selectedLead.archived ? 'fill' : 'regular'} />
                        )}
                        {selectedLead.archived ? 'Restaurar' : 'Archivar'}
                      </Button>
                      {canDeleteLead && (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-10 rounded-xl font-bold hover:bg-destructive/90 transition-all shadow-lg shadow-destructive/10"
                          onClick={() => handleDeleteLead(selectedLead)}
                        >
                          <Trash size={18} className="mr-2" />
                          Eliminar
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="p-6 space-y-8">
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] mb-2">Detalles del contacto</p>
                        <div className="space-y-4">
                          <div className="flex flex-col gap-1 p-3 rounded-xl bg-muted/30 border border-border/40 overflow-hidden group hover:bg-muted/50 transition-colors">
                            <span className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-wider">Email</span>
                            <span className="text-[13px] font-bold text-foreground truncate break-all group-hover:text-primary transition-colors">
                              {selectedLead.email || '—'}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1 p-3 rounded-xl bg-muted/30 border border-border/40 overflow-hidden group hover:bg-muted/50 transition-colors">
                            <span className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-wider">Empresa</span>
                            <span className="text-[13px] font-bold text-foreground truncate group-hover:text-primary transition-colors">
                              {selectedLead.company || '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <div
                        className="flex items-center justify-between mb-4 group cursor-pointer hover:bg-muted/40 p-1 rounded-lg transition-all"
                        onClick={() => {/* TODO: expand media view */ }}
                      >
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Media Compartida</span>
                        <div className="flex items-center gap-1.5 text-muted-foreground group-hover:text-primary transition-colors">
                          <span className="text-xs font-black">{chatMedia.length}</span>
                          <CaretRight size={14} weight="bold" />
                        </div>
                      </div>

                      {chatMedia.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2">
                          {chatMedia.slice(0, 6).map((m: any, i) => (
                            <div
                              key={i}
                              className="aspect-square relative rounded-xl overflow-hidden bg-muted border border-border/30 cursor-pointer hover:ring-2 hover:ring-primary/40 active:scale-95 transition-all shadow-sm group/thumb"
                            >
                              {m.type === 'video' ? (
                                <video src={m.url} className="w-full h-full object-cover" />
                              ) : (
                                <img src={m.url} alt="media" className="w-full h-full object-cover" />
                              )}
                              <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/20 transition-colors flex items-center justify-center">
                                {m.type === 'video' && (
                                  <div className="w-8 h-8 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center">
                                    <VideoCamera weight="fill" className="text-white w-4 h-4" />
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-10 text-center bg-muted/20 rounded-2xl border-2 border-dashed border-border/40">
                          <p className="text-xs text-muted-foreground font-bold italic opacity-60 px-4">No hay archivos compartidos recientemente</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gradient-to-br from-background via-background to-primary/5">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl scale-150 opacity-30" />
              <div className="w-40 h-40 bg-card border border-border/50 rounded-[2.5rem] flex items-center justify-center shadow-2xl relative z-10 animate-in zoom-in duration-700">
                <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center">
                  <ChatCircleDots className="w-10 h-10 text-primary" weight="duotone" />
                </div>
              </div>
            </div>
            <h3 className="text-3xl font-black mb-4 tracking-tight">Centro de Mensajería</h3>
            <p className="max-w-md text-muted-foreground font-medium leading-relaxed">
              Selecciona una conversación de la izquierda para comenzar a chatear.
              Gestiona <span className="text-[#25D366] font-bold">WhatsApp</span> e <span className="text-[#E1306C] font-bold">Instagram</span> en un solo lugar con una experiencia premium.
            </p>
            <div className="mt-10 flex gap-4 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700">
              <div className="flex items-center gap-2 bg-muted p-3 rounded-2xl border border-border/40">
                <WhatsappLogo weight="fill" className="w-5 h-5 text-[#25D366]" />
                <span className="text-xs font-black uppercase tracking-widest">WhatsApp Business</span>
              </div>
              <div className="flex items-center gap-2 bg-muted p-3 rounded-2xl border border-border/40">
                <InstagramLogo weight="fill" className="w-5 h-5 text-[#E1306C]" />
                <span className="text-xs font-black uppercase tracking-widest">Instagram Direct</span>
              </div>
            </div>
          </div>
        )}
      </div>
      {
        selectedLead && (
          <LeadDetailSheet
            lead={selectedLead}
            open={detailSheetOpen}
            onClose={() => setDetailSheetOpen(false)}
            onUpdate={handleLeadUpdate}
            teamMembers={[]}
            companyId={companyId}
            canDeleteLead={canDeleteLead}
            onDeleteLead={() => handleDeleteLead(selectedLead)}
          />
        )
      }
      {lightboxImage && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setLightboxImage(null)}>
          <div className="relative max-w-6xl max-h-[90vh] w-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxImage} alt="Imagen ampliada" className="max-h-[90vh] max-w-full rounded-2xl shadow-2xl" />
            <button
              type="button"
              className="absolute top-3 right-3 bg-black/70 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-black"
              onClick={() => setLightboxImage(null)}
            >
              ×
            </button>
          </div>
        </div>,
        document.body
      )}
      <ChatSettingsDialog open={showChatSettings} onClose={() => setShowChatSettings(false)} empresaId={companyId} />
    </div >
  )
}
