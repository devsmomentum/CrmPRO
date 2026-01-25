import { useState, useEffect } from 'react'
import type { Lead } from '@/lib/types'
import { subscribeToAllMessages, getUnreadMessagesCount } from '@/supabase/services/mensajes'
import { ChatSettingsDialog } from './ChatSettingsDialog'
import { useLeadsList } from '@/hooks/useLeadsList'
import { MessageInput, ChatList, ChatWindow } from './chats'

interface ChatsViewProps {
  companyId: string
  onNavigateToPipeline?: (leadId: string) => void
  canDeleteLead?: boolean
}

// NOTA: safeFormatDate ahora viene de useDateFormat hook como safeFormatDate

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
  const [showChatSettings, setShowChatSettings] = useState(false)

  // NOTA: Los filtros (channelFilter, unreadFilter, searchTerm), sortedLeads, rowVirtualizer,
  // listParentRef, filterScrollRef ahora viven en el componente ChatList.
  // Se eliminaron ~30 líneas de estados y ~40 líneas de código duplicado.

  // ==========================================
  // NOTA: Toda la lógica de loadLeads, fetchMoreLeads, loadUnreadCountsInBatches,
  // loadLastMessagesInBackground y handleScopeChange ahora viene del hook useLeadsList.
  // Se eliminaron ~280 líneas de código duplicado.
  // ==========================================

  // Scroll automático a nuevos mensajes


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
    try {
      await toggleArchive(lead, nextState)
      if (selectedLeadId === lead.id && ((nextState && chatScope === 'active') || (!nextState && chatScope === 'archived'))) {
        setSelectedLeadId(null)
      }
    } catch (err) {
      // Error handling done in hook
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
      }
    } catch (err) {
      // Error handling done in hook
    }
  }

  // NOTA: Las funciones removePendingImage, clearPendingImages, handlePasteClipboard,
  // handleSendMessage ahora están en el componente MessageInput.
  // Se eliminaron ~70 líneas de código duplicado.

  const selectedLead = leads.find(l => l.id === selectedLeadId)



  return (
    <div className="flex flex-1 min-h-0 bg-background rounded-tl-2xl border-t border-l shadow-sm overflow-hidden w-full">
      <ChatList
        leads={leads}
        isInitialLoading={isInitialLoading}
        isFetchingMore={isFetchingMore}
        loadError={loadError}
        unreadCounts={unreadCounts}
        channelByLead={lastChannelByLead}
        chatScope={chatScope}
        companyId={companyId}
        selectedLeadId={selectedLeadId}
        onSelectLead={setSelectedLeadId}
        onScopeChange={handleScopeChange}
        onLoadMore={fetchMoreLeads}
        onRefresh={loadLeads}
        onOpenSettings={() => setShowChatSettings(true)}
      />
      <ChatWindow
        lead={selectedLead || null}
        companyId={companyId}
        canDeleteLead={canDeleteLead}
        onBack={() => setSelectedLeadId(null)}
        onArchive={handleArchiveToggle}
        onDelete={handleDeleteLead}
        onNavigateToPipeline={onNavigateToPipeline}
        updateLeadListOrder={updateLeadListOrder}
        updateUnreadCount={updateUnreadCount}
        onLeadUpdate={(updatedLead) => handleLeadUpdate(updatedLead)}
      />
      <ChatSettingsDialog open={showChatSettings} onClose={() => setShowChatSettings(false)} empresaId={companyId} />
    </div >
  )
}
