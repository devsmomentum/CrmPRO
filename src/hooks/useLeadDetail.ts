/**
 * useLeadDetail - Hook for loading and managing lead detail data
 * 
 * Centralizes the loading of messages, notes, meetings, and presupuestos
 * that were previously scattered across multiple useEffects in LeadDetailSheet.
 */

import { useState, useEffect, useCallback } from 'react'
import { Message, Note, Meeting, Channel } from '@/lib/types'
import { getMessages, subscribeToMessages, markMessagesAsRead } from '@/supabase/services/mensajes'
import { getNotasByLead, createNota, deleteNota } from '@/supabase/services/notas'
import { getLeadMeetings, createLeadMeeting, deleteLeadMeeting } from '@/supabase/services/reuniones'
import { getPresupuestosByLead, PresupuestoPdf } from '@/supabase/services/presupuestosPdf'

// ============================================================================
// Types
// ============================================================================

interface UseLeadDetailOptions {
    leadId: string
    open: boolean
    onMarkAsRead?: (leadId: string) => void
}

interface UseLeadDetailReturn {
    // Data
    messages: Message[]
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
    notes: Note[]
    setNotes: React.Dispatch<React.SetStateAction<Note[]>>
    meetings: Meeting[]
    setMeetings: React.Dispatch<React.SetStateAction<Meeting[]>>
    presupuestosPdf: PresupuestoPdf[]
    setPresupuestosPdf: React.Dispatch<React.SetStateAction<PresupuestoPdf[]>>

    // Loading states
    isLoadingMessages: boolean
    isLoadingNotes: boolean
    isLoadingMeetings: boolean
    isLoadingPdfs: boolean

    // Actions for notes
    addNote: (leadId: string, content: string, creatorName: string) => Promise<Note | null>
    deleteNote: (noteId: string) => Promise<boolean>

    // Actions for meetings
    addMeeting: (meetingData: CreateMeetingData) => Promise<Meeting | null>
    deleteMeeting: (meetingId: string) => Promise<boolean>
}

interface CreateMeetingData {
    leadId: string
    empresaId: string
    title: string
    date: Date
    duration: number
    participants: string[]
    notes?: string
    createdBy: string | null
}

// ============================================================================
// Main Hook
// ============================================================================

export function useLeadDetail(options: UseLeadDetailOptions): UseLeadDetailReturn {
    const { leadId, open, onMarkAsRead } = options

    // State
    const [messages, setMessages] = useState<Message[]>([])
    const [notes, setNotes] = useState<Note[]>([])
    const [meetings, setMeetings] = useState<Meeting[]>([])
    const [presupuestosPdf, setPresupuestosPdf] = useState<PresupuestoPdf[]>([])

    // Loading states
    const [isLoadingMessages, setIsLoadingMessages] = useState(false)
    const [isLoadingNotes, setIsLoadingNotes] = useState(false)
    const [isLoadingMeetings, setIsLoadingMeetings] = useState(false)
    const [isLoadingPdfs, setIsLoadingPdfs] = useState(false)

    // Load messages and subscribe to realtime
    useEffect(() => {
        if (!leadId || !open) return

        setIsLoadingMessages(true)

        // Fetch initial messages
        getMessages(leadId).then(dbMessages => {
            const mapped: Message[] = dbMessages.map(m => ({
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

            // Mark as read if there are unread messages
            const hasUnread = mapped.some(m => !m.read && m.sender === 'lead')
            if (hasUnread) {
                markMessagesAsRead(leadId)
                    .then(() => onMarkAsRead?.(leadId))
                    .catch(console.error)
            }

            setIsLoadingMessages(false)
        }).catch(err => {
            console.error('[useLeadDetail] Error loading messages:', err)
            setIsLoadingMessages(false)
        })

        // Subscribe to new messages
        const subscription = subscribeToMessages(leadId, (newMsg) => {
            const mapped: Message = {
                id: newMsg.id,
                leadId: newMsg.lead_id,
                channel: newMsg.channel as Channel,
                content: newMsg.content,
                timestamp: new Date(newMsg.created_at),
                sender: newMsg.sender as 'team' | 'lead',
                read: newMsg.read,
                metadata: newMsg.metadata
            }
            setMessages(prev => {
                if (prev.find(p => p.id === mapped.id)) return prev
                return [...prev, mapped]
            })
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [leadId, open, onMarkAsRead])

    // Load notes
    useEffect(() => {
        if (!leadId || !open) return

        setIsLoadingNotes(true)
        getNotasByLead(leadId).then(dbNotas => {
            const mapped: Note[] = dbNotas.map((n: any) => ({
                id: n.id,
                leadId: n.lead_id,
                content: n.contenido,
                createdBy: n.creador_nombre || 'Usuario',
                createdAt: new Date(n.created_at)
            }))
            setNotes(mapped)
            setIsLoadingNotes(false)
        }).catch(err => {
            console.error('[useLeadDetail] Error loading notes:', err)
            setIsLoadingNotes(false)
        })
    }, [leadId, open])

    // Load meetings
    useEffect(() => {
        if (!leadId || !open) {
            setMeetings([])
            return
        }

        let isMounted = true
        setIsLoadingMeetings(true)

        getLeadMeetings(leadId)
            .then((data) => {
                if (isMounted) {
                    setMeetings(data)
                    setIsLoadingMeetings(false)
                }
            })
            .catch((err) => {
                console.error('[useLeadDetail] Error loading meetings:', err)
                if (isMounted) setIsLoadingMeetings(false)
            })

        return () => {
            isMounted = false
        }
    }, [leadId, open])

    // Load presupuestos PDF
    useEffect(() => {
        if (!leadId || !open) {
            setPresupuestosPdf([])
            return
        }

        setIsLoadingPdfs(true)
        getPresupuestosByLead(leadId)
            .then(data => {
                setPresupuestosPdf(data)
                setIsLoadingPdfs(false)
            })
            .catch(err => {
                console.error('[useLeadDetail] Error loading PDFs:', err)
                setIsLoadingPdfs(false)
            })
    }, [leadId, open])

    // Note actions
    const addNote = useCallback(async (leadId: string, content: string, creatorName: string): Promise<Note | null> => {
        try {
            const dbNota = await createNota(leadId, content, creatorName)
            const newNote: Note = {
                id: dbNota.id,
                leadId,
                content,
                createdBy: creatorName,
                createdAt: new Date(dbNota.created_at)
            }
            setNotes(prev => [newNote, ...prev])
            return newNote
        } catch (err) {
            console.error('[useLeadDetail] Error creating note:', err)
            return null
        }
    }, [])

    const deleteNote = useCallback(async (noteId: string): Promise<boolean> => {
        try {
            await deleteNota(noteId)
            setNotes(prev => prev.filter(n => n.id !== noteId))
            return true
        } catch (err) {
            console.error('[useLeadDetail] Error deleting note:', err)
            return false
        }
    }, [])

    // Meeting actions
    const addMeeting = useCallback(async (data: CreateMeetingData): Promise<Meeting | null> => {
        try {
            const created = await createLeadMeeting({
                leadId: data.leadId,
                empresaId: data.empresaId,
                title: data.title,
                date: data.date,
                duration: data.duration,
                participants: data.participants,
                notes: data.notes,
                createdBy: data.createdBy
            })
            setMeetings(prev => [...prev, created].sort((a, b) => a.date.getTime() - b.date.getTime()))
            return created
        } catch (err) {
            console.error('[useLeadDetail] Error creating meeting:', err)
            return null
        }
    }, [])

    const deleteMeeting = useCallback(async (meetingId: string): Promise<boolean> => {
        try {
            await deleteLeadMeeting(meetingId)
            setMeetings(prev => prev.filter(m => m.id !== meetingId))
            return true
        } catch (err) {
            console.error('[useLeadDetail] Error deleting meeting:', err)
            return false
        }
    }, [])

    return {
        messages,
        setMessages,
        notes,
        setNotes,
        meetings,
        setMeetings,
        presupuestosPdf,
        setPresupuestosPdf,
        isLoadingMessages,
        isLoadingNotes,
        isLoadingMeetings,
        isLoadingPdfs,
        addNote,
        deleteNote,
        addMeeting,
        deleteMeeting
    }
}
