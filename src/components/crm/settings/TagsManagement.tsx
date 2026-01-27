import { useState, useEffect } from 'react'
import { Tag } from '@/lib/types'
import { getAllUniqueTags, bulkUpdateTag, bulkDeleteTag } from '@/supabase/services/tags'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Trash, Pencil, Plus, Check, X, Tag as TagIcon } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface TagsManagementProps {
    empresaId: string
}

const PRESET_COLORS = [
    '#ef4444', // red
    '#f97316', // orange
    '#f59e0b', // amber
    '#84cc16', // lime
    '#22c55e', // green
    '#10b981', // emerald
    '#06b6d4', // cyan
    '#3b82f6', // blue
    '#6366f1', // indigo
    '#d946ef', // fuchsia
    '#ec4899', // pink
    '#64748b', // slate
]

export function TagsManagement({ empresaId }: TagsManagementProps) {
    const [tags, setTags] = useState<Tag[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isUpdating, setIsUpdating] = useState(false)

    // Editing State
    const [editingTag, setEditingTag] = useState<Tag | null>(null)
    const [newName, setNewName] = useState('')
    const [newColor, setNewColor] = useState('')

    // Creating State
    // NOTA: En este sistema "No-DB Table", crear un tag aquí es simbólico
    // porque hasta que no se asigne a un lead, no persistirá.
    // Sin embargo, para UX, podríamos permitir "crear" y guardarlo localmente
    // o simplemente explicar al usuario que las etiquetas se crean al usarlas.
    // OJO: Para hacerlo persistente necesitaríamos crear un "Dummy Lead" o
    // simplemente aceptar que aquí solo se EDITAN las existentes.
    // DECISIÓN: Permitiremos "Limpiar" etiquetas (renombrar/borrar). 
    // La creación se hará principalmente desde el Chat.

    useEffect(() => {
        loadTags()
    }, [empresaId])

    const loadTags = async () => {
        setIsLoading(true)
        try {
            const data = await getAllUniqueTags(empresaId)
            setTags(data)
        } catch (error) {
            console.error('Error loading tags:', error)
            toast.error('Error cargando etiquetas')
        } finally {
            setIsLoading(false)
        }
    }

    const handleEditStart = (tag: Tag) => {
        setEditingTag(tag)
        setNewName(tag.name)
        setNewColor(tag.color)
    }

    const handleEditCancel = () => {
        setEditingTag(null)
        setNewName('')
        setNewColor('')
    }

    const handleEditSave = async () => {
        if (!editingTag || !newName.trim()) return

        setIsUpdating(true)
        try {
            await bulkUpdateTag(empresaId, editingTag.id, {
                name: newName.trim(),
                color: newColor
            })
            toast.success('Etiqueta actualizada en todos los chats')
            setEditingTag(null)
            loadTags() // Recargar para ver cambios
        } catch (error) {
            console.error(error)
            toast.error('Error actualizando etiqueta')
        } finally {
            setIsUpdating(false)
        }
    }

    const handleDelete = async (tag: Tag) => {
        if (!confirm(`¿Estás seguro de eliminar la etiqueta "${tag.name}" de TODOS los chats? Esta acción no se puede deshacer.`)) return

        setIsUpdating(true)
        try {
            await bulkDeleteTag(empresaId, tag.id)
            toast.success('Etiqueta eliminada de todos los chats')
            loadTags()
        } catch (error) {
            console.error(error)
            toast.error('Error eliminando etiqueta')
        } finally {
            setIsUpdating(false)
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <TagIcon /> Gestión de Etiquetas
                </h2>
                <p className="text-muted-foreground text-sm">
                    Estas son las etiquetas detectadas en tus chats activos.
                    Al editar una etiqueta aquí, cambiará automáticamente en todas las conversaciones donde se use.
                </p>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : tags.length === 0 ? (
                <Card className="bg-muted/30 border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <TagIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
                        <h3 className="font-medium text-lg">No hay etiquetas aún</h3>
                        <p className="text-muted-foreground text-sm max-w-sm mt-2">
                            Las etiquetas aparecerán aquí a medida que las crees y asignes dentro de los chats.
                            Abre un chat y busca el botón "Etiquetas" para empezar.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tags.map(tag => (
                        <Card key={tag.id} className="overflow-hidden group hover:border-primary/50 transition-colors">
                            <CardContent className="p-4 flex items-center justify-between gap-3">
                                {editingTag?.id === tag.id ? (
                                    <div className="flex-1 flex flex-col gap-3 animate-in fade-in duration-200">
                                        <div className="flex items-center gap-2">
                                            <Input
                                                value={newName}
                                                onChange={e => setNewName(e.target.value)}
                                                className="h-8 text-sm"
                                                placeholder="Nombre etiqueta"
                                                autoFocus
                                            />
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <div
                                                        className="w-8 h-8 rounded-full cursor-pointer border shadow-sm shrink-0"
                                                        style={{ backgroundColor: newColor }}
                                                    />
                                                </PopoverTrigger>
                                                <PopoverContent className="w-64 p-3">
                                                    <div className="grid grid-cols-6 gap-2">
                                                        {PRESET_COLORS.map(c => (
                                                            <div
                                                                key={c}
                                                                className={`w-8 h-8 rounded-full cursor-pointer hover:scale-110 transition-transform ${newColor === c ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                                                                style={{ backgroundColor: c }}
                                                                onClick={() => setNewColor(c)}
                                                            />
                                                        ))}
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <Button size="sm" variant="ghost" onClick={handleEditCancel} disabled={isUpdating} className="h-7 text-xs">
                                                Cancelar
                                            </Button>
                                            <Button size="sm" variant="default" onClick={handleEditSave} disabled={isUpdating} className="h-7 text-xs">
                                                {isUpdating ? 'Guardando...' : 'Guardar'}
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <Badge
                                            className="px-3 py-1 text-sm font-medium text-white shadow-sm"
                                            style={{ backgroundColor: tag.color }}
                                        >
                                            {tag.name}
                                        </Badge>

                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                onClick={() => handleEditStart(tag)}
                                            >
                                                <Pencil size={16} />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                onClick={() => handleDelete(tag)}
                                            >
                                                <Trash size={16} />
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
