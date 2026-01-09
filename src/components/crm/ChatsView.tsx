import { useState, useEffect, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Lead } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { MagnifyingGlass, WhatsappLogo, InstagramLogo, PaperPlaneRight, Paperclip, Microphone, Smiley, Check, ChatCircleDots, DownloadSimple, FilePdf, File as FileIcon, Spinner, Stop, X, CaretRight, VideoCamera, Phone, Info, ArrowLeft } from '@phosphor-icons/react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { getLeadsPaged } from '@/supabase/services/leads'
import { getMessages, sendMessage, subscribeToMessages, getLastMessagesForLeadIds, subscribeToAllMessages, getUnreadMessagesCount, markMessagesAsRead, uploadChatAttachment } from '@/supabase/services/mensajes'
import type { Message as DbMessage } from '@/supabase/services/mensajes'
import { toast } from 'sonner'

interface ChatsViewProps {
  companyId: string
}

export function ChatsView({ companyId }: ChatsViewProps) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [showContactInfo, setShowContactInfo] = useState(false)
  const [messages, setMessages] = useState<DbMessage[]>([])
    const [channelFilter, setChannelFilter] = useState<'all' | 'whatsapp' | 'instagram'>('all')
    const [unreadFilter, setUnreadFilter] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [messageInput, setMessageInput] = useState('')
    const [isLoadingMessages, setIsLoadingMessages] = useState(false)
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
    const [lastChannelByLead, setLastChannelByLead] = useState<Record<string, 'whatsapp' | 'instagram'>>({})
    const listParentRef = useRef<HTMLDivElement | null>(null)

    const [isUploading, setIsUploading] = useState(false)
    const [isRecording, setIsRecording] = useState(false)
    const [recordingTime, setRecordingTime] = useState(0)

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const audioChunksRef = useRef<Blob[]>([])
    const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const streamRef = useRef<MediaStream | null>(null)

    const PAGE_SIZE = 500
    const [offset, setOffset] = useState(0)
    const [hasMore, setHasMore] = useState(true)
    const [isFetchingMore, setIsFetchingMore] = useState(false)

    useEffect(() => { if (companyId) void loadLeads() }, [companyId])

    useEffect(() => {
      const el = document.getElementById('chat-scroll-area')
      if (el) el.scrollTop = el.scrollHeight
    }, [messages, selectedLeadId])

    async function loadLeads() {
      try {
        const { data: page } = await getLeadsPaged({ empresaId: companyId, limit: PAGE_SIZE, offset: 0 })
        const data = page || []
        const mapped: Lead[] = data.map((d: any) => ({
          ...d,
          id: d.id,
          name: d.nombre_completo || d.name || 'Sin Nombre',
          phone: d.telefono || d.phone,
          email: d.correo_electronico || d.email,
          createdAt: d.created_at ? new Date(d.created_at) : new Date(),
          lastMessage: d.last_message || '',
          lastMessageAt: d.last_message_at ? new Date(d.last_message_at) : (d.created_at ? new Date(d.created_at) : undefined),
          lastMessageSender: d.last_message_sender || 'team',
          avatar: d.avatar || undefined,
          company: d.empresa || d.company || undefined,
        }))

        const missingIds = mapped.filter(l => !l.lastMessageAt || !l.lastMessage).map(l => l.id)
        if (missingIds.length) {
          const lastByLead = await getLastMessagesForLeadIds(missingIds) as Record<string, DbMessage>
          for (const id of Object.keys(lastByLead)) {
            const m = lastByLead[id]
            const l = mapped.find(x => x.id === id)
            if (l && m) {
              l.lastMessage = m.content || l.lastMessage || ''
              l.lastMessageAt = new Date(m.created_at)
              l.lastMessageSender = m.sender as any
            }
          }
        }

        const channelMap: Record<string, 'whatsapp' | 'instagram'> = {}
        for (const l of mapped) channelMap[l.id] = 'whatsapp'

        const ids = mapped.map(l => l.id)
        const counts = await getUnreadMessagesCount(ids)

        setLeads(mapped)
        setLastChannelByLead(channelMap)
        setUnreadCounts(counts)
        setOffset(mapped.length)
        setHasMore(mapped.length >= PAGE_SIZE)
      } catch (e) {
        console.error('Error loading leads:', e)
      }
    }

    async function fetchMoreLeads() {
      if (!hasMore || isFetchingMore) return
      setIsFetchingMore(true)
      try {
        const { data: page } = await getLeadsPaged({ empresaId: companyId, limit: PAGE_SIZE, offset })
        const data = page || []
        const mapped: Lead[] = data.map((d: any) => ({
          ...d,
          id: d.id,
          name: d.nombre_completo || d.name || 'Sin Nombre',
          phone: d.telefono || d.phone,
          email: d.correo_electronico || d.email,
          createdAt: d.created_at ? new Date(d.created_at) : new Date(),
          lastMessage: d.last_message || '',
          lastMessageAt: d.last_message_at ? new Date(d.last_message_at) : (d.created_at ? new Date(d.created_at) : undefined),
          lastMessageSender: d.last_message_sender || 'team',
          avatar: d.avatar || undefined,
          company: d.empresa || d.company || undefined,
        }))

        const missingIds = mapped.filter(l => !l.lastMessageAt || !l.lastMessage).map(l => l.id)
        if (missingIds.length) {
          const lastByLead = await getLastMessagesForLeadIds(missingIds) as Record<string, DbMessage>
          for (const id of Object.keys(lastByLead)) {
            const m = lastByLead[id]
            const l = mapped.find(x => x.id === id)
            if (l && m) {
              l.lastMessage = m.content || l.lastMessage || ''
              l.lastMessageAt = new Date(m.created_at)
              l.lastMessageSender = m.sender as any
            }
          }
        }

        setLastChannelByLead(prev => {
          const next = { ...prev }
          for (const l of mapped) next[l.id] = next[l.id] || 'whatsapp'
          return next
        })

        const ids = mapped.map(l => l.id)
        const counts = await getUnreadMessagesCount(ids)
        setUnreadCounts(prev => ({ ...prev, ...counts }))

        setLeads(prev => [...prev, ...mapped])
        setOffset(prev => prev + mapped.length)
        setHasMore(mapped.length >= PAGE_SIZE)
      } catch (e) {
        console.error('Error fetching more leads:', e)
      } finally {
        setIsFetchingMore(false)
      }
    }

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

    useEffect(() => {
      const items = rowVirtualizer.getVirtualItems()
      const last = items[items.length - 1]
      if (!last) return
      if (last.index >= sortedLeads.length - 10) fetchMoreLeads()
    }, [rowVirtualizer.getVirtualItems()])

    useEffect(() => {
      if (!selectedLeadId) return
      const load = async () => {
        setIsLoadingMessages(true)
        try { setMessages(await getMessages(selectedLeadId)) } catch (e) { console.error('Error loading messages:', e) } finally { setIsLoadingMessages(false) }
      }
      void load()
      ;(async () => { try { await markMessagesAsRead(selectedLeadId); setUnreadCounts(prev => ({ ...prev, [selectedLeadId]: 0 })) } catch {} })()
      const sub = subscribeToMessages(selectedLeadId, (newMsg) => {
        setMessages(prev => [...prev, newMsg])
        updateLeadListOrder(selectedLeadId, newMsg)
        if (newMsg?.channel) setLastChannelByLead(prev => ({ ...prev, [selectedLeadId]: (newMsg.channel === 'instagram' ? 'instagram' : 'whatsapp') }))
        if (newMsg.sender === 'lead') { (async () => { try { await markMessagesAsRead(selectedLeadId); setUnreadCounts(prev => ({ ...prev, [selectedLeadId]: 0 })) } catch {} })() }
      })
      return () => { try { sub.unsubscribe() } catch {} }
    }, [selectedLeadId])

    useEffect(() => {
      if (leads.length === 0) return
      const ch = subscribeToAllMessages((msg) => {
        updateLeadListOrder(msg.lead_id, msg)
        if (msg?.lead_id && msg?.channel) setLastChannelByLead(prev => ({ ...prev, [msg.lead_id]: (msg.channel === 'instagram' ? 'instagram' : 'whatsapp') }))
        if (selectedLeadId !== msg.lead_id) {
          setUnreadCounts(prev => ({ ...prev, [msg.lead_id]: (prev[msg.lead_id] || 0) + 1 }))
        }
      })
      return () => { try { ch.unsubscribe() } catch {} }
    }, [leads, selectedLeadId])

    function updateLeadListOrder(leadId: string, msg: DbMessage) {
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, lastMessageAt: new Date(msg.created_at), lastMessageSender: msg.sender as any, lastMessage: msg.content } : l))
    }

    const startRecording = async () => {
      if (!selectedLeadId) return
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream

        let mimeType = ''
        const preferredFormats = [
          'audio/ogg;codecs=opus', 
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

        const mediaRecorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream)

        mediaRecorderRef.current = mediaRecorder
        audioChunksRef.current = []

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data)
          }
        }

        mediaRecorder.onstop = async () => {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
          }

          setRecordingTime(0)
          setIsRecording(false)

          const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' })

          if (audioBlob.size === 0) {
            toast.error('No se grabó audio')
            return
          }

          const audioFile = new File([audioBlob], `voice-note-${Date.now()}.ogg`, {
            type: 'audio/ogg'
          })

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
        }

        mediaRecorder.start(500)
        setIsRecording(true)
        setRecordingTime(0)

        recordingIntervalRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1)
        }, 1000)

      } catch (err) {
        console.error('[Audio] Error accessing microphone:', err)
        toast.error('No se pudo acceder al micrófono')
      }
    }

    const stopRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop()
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current)
          recordingIntervalRef.current = null
        }
      }
    }

    async function handleSendMessage(e: React.FormEvent) {
      e.preventDefault()
      if (!selectedLeadId || !messageInput.trim()) return
      try {
        const content = messageInput
        setMessageInput('')
        await sendMessage(selectedLeadId, content, 'team', 'whatsapp')
        setLeads(prev => prev.map(l => l.id === selectedLeadId ? { ...l, lastMessageAt: new Date(), lastMessageSender: 'team', lastMessage: content } : l))
        setLastChannelByLead(prev => ({ ...prev, [selectedLeadId]: 'whatsapp' }))
      } catch (e) {
        console.error('Error sending message:', e)
        toast.error('Error al enviar mensaje')
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
      <div className="flex flex-1 h-full bg-background rounded-tl-2xl border-t border-l shadow-sm overflow-hidden">
        <div className={cn("flex flex-col border-r bg-muted/10 h-full w-full md:w-96 shrink-0 transition-all duration-300", selectedLeadId ? "hidden md:flex" : "flex")}>
          <div className="p-4 space-y-4 bg-background border-b shrink-0">
            <div className="flex items-center gap-2"><h2 className="font-semibold text-lg">Chats</h2><Badge variant="secondary" className="ml-auto">{sortedLeads.length}</Badge></div>
            <div className="relative"><MagnifyingGlass className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar chat..." className="pl-9 bg-muted/50 border-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-muted">
              <button
                onClick={() => { setUnreadFilter(false); setChannelFilter('all') }}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap border shrink-0",
                  !unreadFilter && channelFilter === 'all'
                    ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                )}
              >
                Todos
              </button>
              <button
                onClick={() => setUnreadFilter(!unreadFilter)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap border shrink-0",
                  unreadFilter
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                )}
              >
                No leídos
              </button>
              <button
                onClick={() => setChannelFilter(channelFilter === 'whatsapp' ? 'all' : 'whatsapp')}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1 border shrink-0",
                  channelFilter === 'whatsapp'
                    ? "bg-[#25D366] text-white border-[#25D366]"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                )}
              >
                <WhatsappLogo weight="fill" className="h-3.5 w-3.5" />
                WhatsApp
              </button>
              <button
                onClick={() => setChannelFilter(channelFilter === 'instagram' ? 'all' : 'instagram')}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1 border shrink-0",
                  channelFilter === 'instagram'
                    ? "bg-[#E1306C] text-white border-[#E1306C]"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                )}
              >
                <InstagramLogo weight="fill" className="h-3.5 w-3.5" />
                Instagram
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto" ref={listParentRef}>
            <div className="relative w-full" style={{ height: rowVirtualizer.getTotalSize() }}>
              <div className="absolute top-0 left-0 w-full" style={{ transform: `translateY(${rowVirtualizer.getVirtualItems()[0]?.start || 0}px)` }}>
                {rowVirtualizer.getVirtualItems().map(vi => {
                  const lead = sortedLeads[vi.index]; if (!lead) return null
                  return (
                    <button key={lead.id} onClick={() => setSelectedLeadId(lead.id)} className={cn("flex items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50 border-b border-border/50 h-full w-full", selectedLeadId === lead.id && "bg-muted")} style={{ height: vi.size }}>
                      <div className="relative shrink-0">
                          <Avatar className="h-12 w-12">
                              <AvatarImage src={lead.avatar} />
                              <AvatarFallback>{(lead.name || 'Unknown').substring(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 border border-background">
                            {lastChannelByLead[lead.id] === 'instagram' ? (<InstagramLogo weight="fill" className="h-3.5 w-3.5 text-[#E1306C]" />) : (<WhatsappLogo weight="fill" className="h-3.5 w-3.5 text-[#25D366]" />)}
                          </div>
                      </div>
                      
                      <div className="flex-1 min-w-0 flex flex-col justify-center h-full py-1">
                        <div className="flex justify-between items-baseline mb-1">
                            <span className="font-semibold truncate text-base leading-none text-foreground">{lead.name}</span>
                            <span className={cn("text-xs whitespace-nowrap ml-2", unreadCounts[lead.id] > 0 ? "text-[#25D366] font-medium" : "text-muted-foreground")}>
                                {lead.lastMessageAt ? format(new Date(lead.lastMessageAt), 'HH:mm', { locale: es }) : ''}
                            </span>
                        </div>
                        
                        <div className="flex justify-between items-center gap-2">
                             <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                                {lead.lastMessageSender === 'team' && <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                                <p className={cn("text-sm truncate leading-tight", lead.lastMessageSender === 'lead' && unreadCounts[lead.id] > 0 ? "font-semibold text-foreground" : "text-muted-foreground")}>
                                    {lead.lastMessage || 'Sin mensaje reciente'}
                                </p>
                             </div>
                             
                             {unreadCounts[lead.id] > 0 && (
                                <span className="min-w-[1.25rem] h-5 flex items-center justify-center rounded-full bg-[#25D366] text-white text-[10px] font-bold px-1.5 shrink-0 animate-in zoom-in duration-200">
                                    {unreadCounts[lead.id]}
                                </span>
                             )}
                        </div>
                      </div>
                    </button>
                  )
                })}
                {sortedLeads.length === 0 && (<div className="p-8 text-center text-muted-foreground">No hay chats encontrados</div>)}
                {isFetchingMore && (<div className="p-4 text-center text-muted-foreground">Cargando más...</div>)}
              </div>
            </div>
          </div>
        </div>
        <div className={cn("flex-1 flex flex-row relative h-full overflow-hidden bg-[#efeae2] dark:bg-background/95", !selectedLeadId ? "hidden md:flex" : "flex")}>
          {selectedLead ? (
            <>
              <div className="flex-1 flex flex-col h-full min-w-0 relative transition-all duration-300">
                  <div className="h-16 px-4 border-b bg-background flex items-center justify-between shrink-0 cursor-pointer hover:bg-muted/30 transition-colors group" onClick={() => setShowContactInfo(!showContactInfo)}>
                    <div className="flex items-center gap-3 min-w-0 overflow-hidden">
                        <Button variant="ghost" size="icon" className="md:hidden shrink-0 -ml-2 mr-1 h-10 w-10 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); setSelectedLeadId(null); }}>
                             <ArrowLeft className="w-6 h-6" />
                        </Button>
                        <Avatar className="cursor-default shrink-0">
                            <AvatarImage src={selectedLead.avatar} />
                            <AvatarFallback>{(selectedLead.name || 'Unknown').substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                            <h3 className="font-semibold truncate text-sm sm:text-base leading-tight">{selectedLead.name}</h3>
                            <div className="flex items-center text-xs text-muted-foreground min-w-0">
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
                    <div className="flex items-center gap-3 text-muted-foreground shrink-0 pl-2">
                        <MagnifyingGlass className="w-5 h-5 cursor-pointer hover:text-foreground" onClick={(e) => { e.stopPropagation(); /* TODO: Implement search */ }} />
                        <div className="h-4 w-px bg-border hidden sm:block" />
                        <button type="button" onClick={(e) => { e.stopPropagation(); setShowContactInfo(!showContactInfo); }} className={cn("p-2 rounded-full hover:bg-muted transition-colors", showContactInfo ? "bg-muted text-foreground" : "")}>
                            <Info className="w-5 h-5" weight={showContactInfo ? "fill" : "regular"} />
                        </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6" id="chat-scroll-area">
                <div className="space-y-4 max-w-3xl mx-auto pb-4">
                  {messages.map((msg, idx) => {
                    const isTeam = msg.sender === 'team'
                    
                    const data = msg.metadata?.data || msg.metadata || {};
                    let mediaUrl =
                      data.mediaUrl ||
                      data.media?.links?.download ||
                      data.media?.url ||
                      data.media?.publicUrl ||
                      data.media?.downloadUrl ||
                      (data.type === 'image' && data.body?.startsWith('http') ? data.body : null);

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

                    //Logica enviar audios, fotos etc
                    
                    let contentType: string | null = null;
                    let contentIcon: JSX.Element | null = null;
                    if (mediaUrl) {
                        const lowerUrl = mediaUrl.toLowerCase();
                        const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].some(ext => lowerUrl.includes(ext)) || (data.type === 'image');
                        const isVideo = ['.mp4', '.webm', '.ogg', '.mov'].some(ext => lowerUrl.includes(ext)) || (data.type === 'video');
                        const isAudio = ['.mp3', '.wav', '.ogg', '.oga', '.m4a', '.aac', '.opus'].some(ext => lowerUrl.includes(ext)) ||
                          (data.type === 'audio') ||
                          (data.type === 'ptt');
                        const isPdf = lowerUrl.includes('.pdf');

                        if (isAudio) {
                          contentType = data.type === 'ptt' ? 'Nota de voz' : 'Audio';
                          contentIcon = <Microphone />;
                        } else if (isImage) {
                          contentType = 'Imagen';
                          contentIcon = <FileIcon />; // Placeholder
                        } else if (isVideo) {
                          contentType = 'Video';
                          contentIcon = <FileIcon />; // Placeholder
                        } else if (isPdf) {
                          contentType = 'PDF';
                          contentIcon = <FilePdf />;
                        } else {
                          contentType = 'Archivo';
                          contentIcon = <FileIcon />;
                        }
                    }

                    return (
                      <div key={msg.id || idx} className={cn("flex w-full mb-2", isTeam ? "justify-end" : "justify-start")}>
                        <div className={cn("max-w-[70%] px-4 py-2 rounded-lg shadow-sm text-sm relative", isTeam ? "bg-[#d9fdd3] text-gray-900 rounded-tr-none" : "bg-white text-gray-900 rounded-tl-none")}> 
                          
                          {(() => {
                              if (!msg.content) return null;
                              if (msg.content.startsWith('http')) return null;

                              if (mediaUrl) {
                                const urlRegex = /https?:\/\/[^\s]+/gi;
                                const cleanedContent = msg.content.replace(urlRegex, '').trim();
                                if (cleanedContent && cleanedContent.length > 0) {
                                  return <p className="whitespace-pre-wrap leading-relaxed">{cleanedContent}</p>;
                                }
                                return null;
                              }
                              return <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>;
                          })()}

                          {(() => {
                            if (!mediaUrl) return null;
                             const lowerUrl = mediaUrl.toLowerCase();
                             const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].some(ext => lowerUrl.includes(ext)) || (data.type === 'image');
                             const isVideo = ['.mp4', '.webm', '.ogg', '.mov'].some(ext => lowerUrl.includes(ext)) || (data.type === 'video');
                             const isAudio = ['.mp3', '.wav', '.ogg', '.oga', '.m4a', '.aac', '.opus'].some(ext => lowerUrl.includes(ext)) ||
                               (data.type === 'audio') ||
                               (data.type === 'ptt'); 

                             if (isImage) {
                               return (
                                 <div className="mt-2 rounded-md overflow-hidden">
                                   <img src={mediaUrl} alt="Imagen adjunta" className="max-w-full h-auto object-cover max-h-60" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                 </div>
                               );
                             } else if (isVideo) {
                               return (
                                 <div className="mt-2 rounded-md overflow-hidden">
                                   <video src={mediaUrl} controls className="max-w-full h-auto max-h-60" />
                                 </div>
                               );
                             } else if (isAudio) {
                               return (
                                 <div className="mt-2 flex items-center gap-3 bg-muted/50 p-2 rounded-md border border-border max-w-full">
                                   <div className="bg-green-500 p-2 rounded-full text-white shrink-0">
                                      <Microphone size={16} weight="fill" />
                                   </div>
                                   <div className="flex-1 min-w-0">
                                     <audio src={mediaUrl} controls className="w-full h-8 max-w-[200px]" style={{ maxHeight: '32px' }} />
                                   </div>
                                 </div>
                               );
                             } else {
                               const fileName = mediaUrl.split('/').pop()?.split('?')[0] || 'Archivo adjunto';
                               return (
                                 <div className="mt-2 flex items-center gap-3 bg-muted/50 p-2 rounded-md border border-border max-w-full hover:bg-muted transition-colors">
                                   <div className="bg-background p-2 rounded-md text-primary shadow-sm">
                                      <FileIcon size={24} weight="duotone" />
                                   </div>
                                   <div className="flex-1 min-w-0 overflow-hidden">
                                     <p className="text-sm font-medium truncate" title={fileName}>{fileName}</p>
                                     <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1">Download</a>
                                   </div>
                                 </div>
                               )
                             }
                          })()}

                          <div className={cn("text-[10px] mt-1 flex items-center gap-1 opacity-70", isTeam ? "justify-end" : "justify-start")}> {format(new Date(msg.created_at), 'HH:mm')}{isTeam && <Check className="w-3 h-3" />} </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} id="scroll-bottom" />
                </div>
              </div>
              <div className="p-4 bg-background border-t shrink-0">
                <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto flex gap-2 items-end relative">
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
                    className="rounded-full text-muted-foreground"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                   {isUploading ? <Spinner size={20} className="animate-spin" /> : <Paperclip className="w-5 h-5" />}
                  </Button>
                  <div className="flex-1 bg-muted rounded-2xl px-4 py-2 flex items-center gap-2">
                    <input className="flex-1 bg-transparent border-none focus:outline-none text-sm min-h-[24px]" placeholder={isRecording ? "Grabando nota de voz..." : "Escribe un mensaje"} value={messageInput} onChange={(e) => setMessageInput(e.target.value)} disabled={isUploading || isRecording} />
                  </div>
                  {messageInput.trim() ? (
                    <Button type="submit" size="icon" className="rounded-full bg-[#00a884] hover:bg-[#008f6f]" disabled={isUploading || isRecording}><PaperPlaneRight className="w-5 h-5 text-white" weight="fill" /></Button>
                  ) : (
                    <Button 
                      type="button" 
                      size="icon" 
                      variant={isRecording ? "destructive" : "ghost"} 
                      className={cn("rounded-full text-muted-foreground", isRecording && "bg-destructive text-white hover:bg-destructive/90")}
                      disabled={isUploading}
                      onClick={() => isRecording ? stopRecording() : startRecording()}
                    >
                      {isRecording ? <Stop className="w-5 h-5" weight="fill" /> : <Microphone className="w-5 h-5" />}
                    </Button>
                  )}
                  {isRecording && (
                     <div className="absolute right-0 -top-12 bg-background border p-2 rounded-md shadow flex items-center gap-2 text-destructive animate-pulse z-10">
                        <div className="w-2 h-2 rounded-full bg-destructive" />
                        <span className="text-sm font-mono">
                          {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:{(recordingTime % 60).toString().padStart(2, '0')}
                        </span>
                     </div>
                  )}
                </form>
              </div>
              </div>

              {showContactInfo && (
                <div className={cn(
                    "h-full flex flex-col shrink-0 animate-in slide-in-from-right duration-300 shadow-xl overflow-hidden z-20 bg-background",
                    "absolute inset-0 w-full md:static md:w-[350px] md:border-l border-border"
                )}>
                    <div className="h-16 px-4 bg-muted/30 border-b flex items-center gap-3 shrink-0">
                        <button onClick={() => setShowContactInfo(false)} className="hover:bg-muted p-2 rounded-full transition-colors text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="w-5 h-5 md:hidden" />
                            <X className="w-5 h-5 hidden md:block" />
                        </button>
                        <span className="font-medium">Info. del contacto</span>
                    </div>
                    <div className="flex-1 overflow-y-auto snippet-scroll-hide">
                        <div className="flex flex-col items-center p-8 pb-6 bg-background border-b border-border/50">
                            <Avatar className="w-32 h-32 mb-4 shadow-sm ring-1 ring-border">
                                <AvatarImage src={selectedLead.avatar} />
                                <AvatarFallback className="text-4xl">{(selectedLead.name || '?').substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <h2 className="text-xl font-medium text-center text-foreground">{selectedLead.name}</h2>
                            <p className="text-muted-foreground mt-1 text-sm">{selectedLead.phone}</p>
                        </div>
                        
                        <div className="p-4 bg-background border-b border-border/50 space-y-4">
                             <div className="space-y-1">
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Correo electrónico</p>
                                <p className="text-sm truncate select-all">{selectedLead.email || '—'}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Empresa</p>
                                <p className="text-sm truncate">{selectedLead.company || '—'}</p>
                            </div>
                        </div>

                        <div className="p-4 bg-background">
                            <div className="flex items-center justify-between mb-3 cursor-pointer hover:bg-muted/50 p-2 rounded-lg -mx-2 transition-colors group">
                                <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground">Archivos, enlaces y docs.</span>
                                <div className="flex items-center gap-1 text-muted-foreground group-hover:text-foreground">
                                    <span className="text-xs">{chatMedia.length}</span>
                                    <CaretRight className="w-4 h-4" />
                                </div>
                            </div>
                            
                            {chatMedia.length > 0 ? (
                                <div className="grid grid-cols-3 gap-2">
                                    {chatMedia.slice(0, 6).map((m: any, i) => (
                                        <div key={i} className="aspect-square relative rounded-md overflow-hidden bg-muted border cursor-pointer hover:opacity-90">
                                            {m.type === 'video' ? (
                                                <video src={m.url} className="w-full h-full object-cover" />
                                            ) : (
                                                <img src={m.url} alt="media" className="w-full h-full object-cover" />
                                            )}
                                            {m.type === 'video' && <div className="absolute inset-0 flex items-center justify-center bg-black/20"><VideoCamera weight="fill" className="text-white w-6 h-6" /></div>}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground py-2 italic text-center">No hay media compartida</p>
                            )}
                        </div>
                    </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground p-8 bg-background/50">
              <div className="w-32 h-32 bg-muted/30 rounded-full flex items-center justify-center mb-6"><ChatCircleDots className="w-16 h-16 opacity-50" /></div>
              <h3 className="text-xl font-semibold mb-2"> Web / Chat</h3>
              <p className="max-w-md">Selecciona un lead de la izquierda para ver su conversación. Envía y recibe mensajes de WhatsApp e Instagram en tiempo real.</p>
            </div>
          )}
        </div>
      </div>
    )
}
