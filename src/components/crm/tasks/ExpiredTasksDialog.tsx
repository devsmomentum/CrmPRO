import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Task } from '@/lib/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CheckCircle, Clock, PencilSimple, WarningCircle, CalendarBlank, Users, CaretRight, Trash } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ExpiredTasksDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    tasks: Task[]
    onCompleteTask: (task: Task) => void
    onEditTask: (task: Task) => void
    onDeleteTask: (task: Task) => void
    onClearAll: () => void
}

export function ExpiredTasksDialog({
    open,
    onOpenChange,
    tasks,
    onCompleteTask,
    onEditTask,
    onDeleteTask,
    onClearAll
}: ExpiredTasksDialogProps) {

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return 'bg-red-500/10 text-red-600 border-red-200'
            case 'medium': return 'bg-orange-500/10 text-orange-600 border-orange-200'
            case 'low': return 'bg-blue-500/10 text-blue-600 border-blue-200'
            default: return 'bg-gray-100 text-gray-600 border-gray-200'
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <div className="h-8 w-8 rounded-full bg-rose-100 flex items-center justify-center">
                            <WarningCircle size={20} className="text-rose-600" weight="fill" />
                        </div>
                        Tareas Vencidas
                        {tasks.length > 0 && (
                            <Badge variant="secondary" className="bg-rose-100 text-rose-700 hover:bg-rose-200 ml-2 border border-rose-200">
                                {tasks.length}
                            </Badge>
                        )}

                        {tasks.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    if (confirm('¿Estás seguro de que quieres eliminar TODAS las tareas vencidas? Esta acción no se puede deshacer.')) {
                                        onClearAll()
                                    }
                                }}
                                className="ml-auto text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 h-7 text-xs"
                            >
                                <Trash size={14} className="mr-1.5" />
                                Limpiar todas
                            </Button>
                        )}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Tareas pendientes que han superado su fecha de vencimiento.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/5">
                    {tasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 opacity-60">
                            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                                <CheckCircle size={32} className="text-emerald-600" weight="duotone" />
                            </div>
                            <div>
                                <p className="font-bold text-lg text-foreground">¡Todo al día!</p>
                                <p className="text-sm text-muted-foreground">No tienes tareas vencidas pendientes</p>
                            </div>
                        </div>
                    ) : (
                        tasks.map(task => (
                            <div
                                key={task.id}
                                className="group relative flex flex-col gap-2 p-4 rounded-xl border border-rose-100 bg-white shadow-sm hover:shadow-md hover:border-rose-200 transition-all"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 flex-1">
                                        {/* Checkbox Styled Button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                if (confirm('¿Marcar tarea como completada?')) {
                                                    onCompleteTask(task)
                                                }
                                            }}
                                            className="mt-0.5 h-5 w-5 rounded-full border-2 border-muted-foreground/30 hover:border-primary hover:bg-primary/10 cursor-pointer flex items-center justify-center transition-colors shrink-0"
                                            title="Marcar como completada"
                                        >
                                            <CheckCircle size={12} weight="bold" className="text-primary opacity-0 hover:opacity-100" />
                                        </button>

                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold text-sm text-foreground leading-none">{task.title}</p>
                                                <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 uppercase font-bold tracking-wider border rounded-md', getPriorityColor(task.priority))}>
                                                    {task.priority}
                                                </Badge>
                                            </div>

                                            {task.description && (
                                                <p className="text-xs text-muted-foreground line-clamp-1">{task.description}</p>
                                            )}
                                        </div>
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 -mt-1 -mr-1 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => onEditTask(task)}
                                        title="Editar tarea"
                                    >
                                        <PencilSimple size={16} />
                                    </Button>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 -mt-1 -mr-1 text-muted-foreground hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            if (confirm('¿Eliminar esta tarea permanentemente?')) {
                                                onDeleteTask(task)
                                            }
                                        }}
                                        title="Eliminar tarea"
                                    >
                                        <Trash size={16} />
                                    </Button>
                                </div>

                                <div className="flex items-center justify-between pt-2 mt-1 border-t border-border/40">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-rose-600 bg-rose-50 px-2 py-1 rounded-md border border-rose-100">
                                            <CalendarBlank size={12} weight="bold" />
                                            <span>{format(new Date(task.dueDate), "d MMM", { locale: es })}</span>
                                        </div>

                                        {task.leadName && (
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80 max-w-[150px]">
                                                <Users size={12} />
                                                <span className="truncate" title={task.leadName}>{task.leadName}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t bg-background flex justify-end">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cerrar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
