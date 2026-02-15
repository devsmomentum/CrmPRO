import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Task } from '@/lib/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CheckCircle, Trash, ClockCounterClockwise, Spinner } from '@phosphor-icons/react'
import { getTaskHistory, deleteTask, deleteCompletedTasks } from '@/supabase/services/tasks'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'

interface TaskHistoryDialogProps {
    companyId: string
    trigger?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function TaskHistoryDialog({ companyId, trigger, open: controlledOpen, onOpenChange }: TaskHistoryDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : internalOpen
    const setOpen = isControlled ? onOpenChange! : setInternalOpen

    const [loading, setLoading] = useState(false)
    const [tasks, setTasks] = useState<Task[]>([])

    const loadHistory = async () => {
        setLoading(true)
        try {
            const data = await getTaskHistory(companyId)
            setTasks(data)
        } catch (error) {
            console.error(error)
            toast.error('Error cargando historial')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (open && companyId) {
            loadHistory()
        }
    }, [open, companyId])

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar esta tarea del historial permanentemente?')) return
        try {
            await deleteTask(id)
            setTasks(prev => prev.filter(t => t.id !== id))
            toast.success('Tarea eliminada')
        } catch (error) {
            toast.error('Error al eliminar')
        }
    }

    const handleClearHistory = async () => {
        if (!confirm('¿Estás seguro de que quieres borrar TODAS las tareas completadas?')) return
        try {
            await deleteCompletedTasks(companyId)
            setTasks([])
            toast.success('Historial limpiado')
        } catch (error) {
            toast.error('Error al limpiar historial')
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span>Historial de Tareas</span>
                        {tasks.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={handleClearHistory} className="text-destructive hover:bg-destructive/10 text-xs">
                                <Trash className="mr-1" /> Limpiar todo
                            </Button>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-3 py-4">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Spinner className="animate-spin text-primary" size={24} />
                        </div>
                    ) : tasks.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <ClockCounterClockwise size={48} className="mx-auto mb-3 opacity-20" />
                            <p>No hay tareas en el historial</p>
                        </div>
                    ) : (
                        tasks.map(task => (
                            <div key={task.id} className="flex items-start justify-between p-3 rounded-lg border bg-muted/30">
                                <div>
                                    <p className="line-through text-muted-foreground font-medium">{task.title}</p>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                        <Badge variant="outline" className="text-[10px] px-1 h-4">
                                            {task.type}
                                        </Badge>
                                        <span>Completada: {task.completedAt ? format(task.completedAt, "PPP", { locale: es }) : 'N/A'}</span>
                                    </div>
                                    {task.leadName && (
                                        <p className="text-xs text-muted-foreground mt-1">Lead: {task.leadName}</p>
                                    )}
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(task.id)}>
                                    <Trash size={16} />
                                </Button>
                            </div>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
