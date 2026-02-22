/**
 * NotesTab Component
 * 
 * Muestra y permite gestionar notas del lead.
 * Extraído de LeadDetailSheet para mantener el código organizado.
 */

import { Note } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Note as NoteIcon, Trash } from '@phosphor-icons/react'
import { safeFormatDate } from '@/hooks/useDateFormat'

interface NotesTabProps {
    notes: Note[]
    noteInput: string
    onNoteInputChange: (value: string) => void
    onAddNote: () => void
    onDeleteNote: (noteId: string) => void
    canEdit: boolean
    translations: {
        placeholder: string
        addNote: string
        noNotes: string
    }
}

export function NotesTab({
    notes,
    noteInput,
    onNoteInputChange,
    onAddNote,
    onDeleteNote,
    canEdit,
    translations: t
}: NotesTabProps) {
    return (
        <div className="flex-1 p-6 flex flex-col">
            <div className="mb-4">
                <Textarea
                    value={noteInput}
                    onChange={(e) => onNoteInputChange(e.target.value)}
                    placeholder={t.placeholder}
                    className="mb-2"
                    disabled={!canEdit}
                />
                <Button onClick={onAddNote} size="sm" disabled={!canEdit}>
                    <NoteIcon size={16} className="mr-2" />
                    {t.addNote}
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <div className="space-y-3">
                    {notes.map(note => (
                        <div key={note.id} className="p-3 border border-border rounded-lg overflow-hidden">
                            <div className="flex justify-between items-start gap-2">
                                <p className="text-sm flex-1 min-w-0 break-all whitespace-pre-wrap overflow-hidden">
                                    {note.content}
                                </p>
                                {canEdit && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => onDeleteNote(note.id)}
                                        title="Eliminar nota"
                                    >
                                        <Trash size={14} />
                                    </Button>
                                )}
                            </div>
                            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                                <span>{note.createdBy}</span>
                                <span>{safeFormatDate(note.createdAt, 'MMM d, yyyy h:mm a')}</span>
                            </div>
                        </div>
                    ))}
                    {notes.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">{t.noNotes}</p>
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}
