import { useState, useEffect, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Lead } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { MagnifyingGlass, WhatsappLogo, InstagramLogo, PaperPlaneRight, Paperclip, Microphone, Smiley, Check, ChatCircleDots } from '@phosphor-icons/react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { getLeadsPaged } from '@/supabase/services/leads'
import { getMessages, sendMessage, subscribeToMessages, getLastMessagesForLeadIds, subscribeToAllMessages, getUnreadMessagesCount, markMessagesAsRead } from '@/supabase/services/mensajes'
import type { Message as DbMessage } from '@/supabase/services/mensajes'
import { toast } from 'sonner'

interface ChatsViewProps {
  companyId: string
}

export function ChatsView({ companyId }: ChatsViewProps) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<DbMessage[]>([])
    const [channelFilter, setChannelFilter] = useState<'all' | 'whatsapp' | 'instagram'>('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [messageInput, setMessageInput] = useState('')
    const [isLoadingMessages, setIsLoadingMessages] = useState(false)
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
    const [lastChannelByLead, setLastChannelByLead] = useState<Record<string, 'whatsapp' | 'instagram'>>({})
    const listParentRef = useRef<HTMLDivElement | null>(null)

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
      if (channelFilter !== 'all') filtered = filtered.filter(l => (lastChannelByLead[l.id] || 'whatsapp') === channelFilter)
      return filtered.sort((a, b) => {
        const senderA = a.lastMessageSender === 'lead' ? 1 : 0
        const senderB = b.lastMessageSender === 'lead' ? 1 : 0
        if (senderA !== senderB) return senderB - senderA
        const dateA = (a.lastMessageAt ? new Date(a.lastMessageAt) : a.createdAt || new Date(0)).getTime()
        const dateB = (b.lastMessageAt ? new Date(b.lastMessageAt) : b.createdAt || new Date(0)).getTime()
        return dateB - dateA
      })
    }, [leads, searchTerm, channelFilter, lastChannelByLead])

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
          const lead = leads.find(l => l.id === msg.lead_id)
          toast.info(lead?.name || 'Nuevo mensaje', { description: msg.content?.slice(0, 120), action: { label: 'Abrir', onClick: () => setSelectedLeadId(msg.lead_id) } })
          setUnreadCounts(prev => ({ ...prev, [msg.lead_id]: (prev[msg.lead_id] || 0) + 1 }))
        }
      })
      return () => { try { ch.unsubscribe() } catch {} }
    }, [leads, selectedLeadId])

    function updateLeadListOrder(leadId: string, msg: DbMessage) {
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, lastMessageAt: new Date(msg.created_at), lastMessageSender: msg.sender as any, lastMessage: msg.content } : l))
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

    return (
      <div className="flex flex-1 h-full bg-background rounded-tl-2xl border-t border-l shadow-sm overflow-hidden">
        <div className="w-96 flex flex-col border-r bg-muted/10 h-full">
          <div className="p-4 space-y-4 bg-background border-b shrink-0">
            <div className="flex items-center gap-2"><h2 className="font-semibold text-lg">Chats</h2><Badge variant="secondary" className="ml-auto">{sortedLeads.length}</Badge></div>
            <div className="relative"><MagnifyingGlass className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar chat..." className="pl-9 bg-muted/50 border-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={channelFilter === 'whatsapp' ? 'default' : 'outline'} className={cn("w-full gap-2", channelFilter === 'whatsapp' && "bg-[#25D366] hover:bg-[#25D366]/90")} onClick={() => setChannelFilter(channelFilter === 'whatsapp' ? 'all' : 'whatsapp')}><WhatsappLogo weight="fill" className="h-5 w-5" />WhatsApp</Button>
              <Button variant={channelFilter === 'instagram' ? 'default' : 'outline'} className={cn("w-full gap-2", channelFilter === 'instagram' && "bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white hover:opacity-90")} onClick={() => setChannelFilter(channelFilter === 'instagram' ? 'all' : 'instagram')}><InstagramLogo weight="fill" className="h-5 w-5" />Instagram</Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto" ref={listParentRef}>
            <div className="relative w-full" style={{ height: rowVirtualizer.getTotalSize() }}>
              <div className="absolute top-0 left-0 w-full" style={{ transform: `translateY(${rowVirtualizer.getVirtualItems()[0]?.start || 0}px)` }}>
                {rowVirtualizer.getVirtualItems().map(vi => {
                  const lead = sortedLeads[vi.index]; if (!lead) return null
                  return (
                    <button key={lead.id} onClick={() => setSelectedLeadId(lead.id)} className={cn("flex items-start gap-3 p-4 text-left transition-colors hover:bg-muted/50 border-b border-border/50", selectedLeadId === lead.id && "bg-muted")} style={{ height: vi.size }}>
                      <div className="relative"><Avatar><AvatarImage src={lead.avatar} /><AvatarFallback>{(lead.name || 'Unknown').substring(0, 2).toUpperCase()}</AvatarFallback></Avatar><div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">{lastChannelByLead[lead.id] === 'instagram' ? (<InstagramLogo weight="fill" className="h-4 w-4 text-[#E1306C]" />) : (<WhatsappLogo weight="fill" className="h-4 w-4 text-[#25D366]" />)}</div></div>
                      <div className="flex-1 overflow-hidden"><div className="flex justify-between items-center mb-1"><span className="font-medium truncate">{lead.name}</span><div className="flex items-center gap-2 ml-2">{unreadCounts[lead.id] > 0 && (<span className="text-[10px] bg-primary text-primary-foreground rounded-full px-2 py-0.5">{unreadCounts[lead.id]}</span>)}<span className="text-xs text-muted-foreground whitespace-nowrap">{lead.lastMessageAt ? format(new Date(lead.lastMessageAt), 'HH:mm', { locale: es }) : ''}</span></div></div><p className={cn("text-sm truncate", lead.lastMessageSender === 'lead' ? "font-semibold text-foreground" : "text-muted-foreground")}>{lead.lastMessageSender === 'team' && <span className="mr-1">✓</span>}{lead.lastMessage || 'Sin mensaje reciente'}</p></div>
                    </button>
                  )
                })}
                {sortedLeads.length === 0 && (<div className="p-8 text-center text-muted-foreground">No hay chats encontrados</div>)}
                {isFetchingMore && (<div className="p-4 text-center text-muted-foreground">Cargando más...</div>)}
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col bg-[#efeae2] dark:bg-background/95 h-full overflow-hidden">
          {selectedLead ? (
            <>
              <div className="h-16 px-6 border-b bg-background flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3"><Avatar><AvatarImage src={selectedLead.avatar} /><AvatarFallback>{(selectedLead.name || 'Unknown').substring(0, 2).toUpperCase()}</AvatarFallback></Avatar><div><h3 className="font-semibold">{selectedLead.name}</h3><div className="flex items-center gap-2 text-xs text-muted-foreground"><span>{selectedLead.phone}</span>{selectedLead.company && (<><span>•</span><span>{selectedLead.company}</span></>)}</div></div></div>
                <div className="flex items-center gap-2" />
              </div>
              <div className="flex-1 overflow-y-auto p-6" id="chat-scroll-area">
                <div className="space-y-4 max-w-3xl mx-auto pb-4">
                  {messages.map((msg, idx) => {
                    const isTeam = msg.sender === 'team'
                    return (
                      <div key={msg.id || idx} className={cn("flex w-full mb-2", isTeam ? "justify-end" : "justify-start")}>
                        <div className={cn("max-w-[70%] px-4 py-2 rounded-lg shadow-sm text-sm relative", isTeam ? "bg-[#d9fdd3] text-gray-900 rounded-tr-none" : "bg-white text-gray-900 rounded-tl-none")}> 
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                          <div className={cn("text-[10px] mt-1 flex items-center gap-1 opacity-70", isTeam ? "justify-end" : "justify-start")}> {format(new Date(msg.created_at), 'HH:mm')}{isTeam && <Check className="w-3 h-3" />} </div>
                        </div>
                      </div>
                    )
                  })}
                  <div id="scroll-bottom" />
                </div>
              </div>
              <div className="p-4 bg-background border-t shrink-0">
                <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto flex gap-2 items-end">
                  <Button type="button" size="icon" variant="ghost" className="rounded-full text-muted-foreground"><Smiley className="w-6 h-6" /></Button>
                  <Button type="button" size="icon" variant="ghost" className="rounded-full text-muted-foreground"><Paperclip className="w-5 h-5" /></Button>
                  <div className="flex-1 bg-muted rounded-2xl px-4 py-2 flex items-center gap-2">
                    <input className="flex-1 bg-transparent border-none focus:outline-none text-sm min-h-[24px]" placeholder="Escribe un mensaje" value={messageInput} onChange={(e) => setMessageInput(e.target.value)} />
                  </div>
                  {messageInput.trim() ? (
                    <Button type="submit" size="icon" className="rounded-full bg-[#00a884] hover:bg-[#008f6f]"><PaperPlaneRight className="w-5 h-5 text-white" weight="fill" /></Button>
                  ) : (
                    <Button type="button" size="icon" variant="ghost" className="rounded-full text-muted-foreground"><Microphone className="w-5 h-5" /></Button>
                  )}
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground p-8 bg-background/50">
              <div className="w-32 h-32 bg-muted/30 rounded-full flex items-center justify-center mb-6"><ChatCircleDots className="w-16 h-16 opacity-50" /></div>
              <h3 className="text-xl font-semibold mb-2">WhatsApp Web / Chat</h3>
              <p className="max-w-md">Selecciona un lead de la izquierda para ver su conversación. Envía y recibe mensajes de WhatsApp e Instagram en tiempo real.</p>
            </div>
          )}
        </div>
      </div>
    )
}
