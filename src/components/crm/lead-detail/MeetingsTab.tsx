/**
 * MeetingsTab Component
 * 
 * Muestra y permite gestionar reuniones del lead.
 * Extraído de LeadDetailSheet para mantener el código organizado.
 */

import { Meeting, TeamMember } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Plus, Trash } from '@phosphor-icons/react'
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
import { safeFormatDate } from '@/hooks/useDateFormat'

interface MeetingsTabProps {
    meetings: Meeting[]
    onShowMeetingDialog: () => void
    onDeleteMeeting: (meetingId: string) => void
    deletingMeetingId: string | null
    canEdit: boolean
    translations: {
        title: string
        addMeeting: string
        noMeetings: string
        participants: string
    }
}

export function MeetingsTab({
    meetings,
    onShowMeetingDialog,
    onDeleteMeeting,
    deletingMeetingId,
    canEdit,
    translations: t
}: MeetingsTabProps) {
    return (
        <div className="flex-1 p-6">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{t.title}</h3>
                    {canEdit && (
                        <Button size="sm" onClick={onShowMeetingDialog}>
                            <Plus size={16} className="mr-2" />
                            {t.addMeeting}
                        </Button>
                    )}
                </div>

                {meetings.map(meeting => {
                    const participantNames = meeting.participants
                        .map(participant => participant.name)
                        .filter(Boolean)
                    const participantDisplay = participantNames.length > 0
                        ? participantNames.join(', ')
                        : 'Sin participantes'

                    return (
                        <div key={meeting.id} className="p-4 border border-border rounded-lg">
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <h4 className="font-medium">{meeting.title}</h4>
                                    <p className="text-sm text-muted-foreground">
                                        {safeFormatDate(meeting.date, 'MMM d, yyyy h:mm a')} • {meeting.duration}min
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
                                                    onClick={() => onDeleteMeeting(meeting.id)}
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
                                {t.participants}: {participantDisplay}
                            </div>
                        </div>
                    )
                })}

                {meetings.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">{t.noMeetings}</p>
                )}
            </div>
        </div>
    )
}
