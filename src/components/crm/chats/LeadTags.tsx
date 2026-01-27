import { useState, useEffect } from 'react'
import { Tag } from '@/lib/types'
import { getAllUniqueTags, addTagToLead, removeTagFromLead } from '@/supabase/services/tags'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Plus, X, Tag as TagIcon, Check } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface LeadTagsProps {
    leadId: string
    currentTags: Tag[]
    companyId: string
    onUpdate: (newTags: Tag[]) => void
}

const PRESET_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981',
    '#06b6d4', '#3b82f6', '#6366f1', '#d946ef', '#ec4899', '#64748b'
]

export function LeadTags({ leadId, currentTags, companyId, onUpdate }: LeadTagsProps) {
    const [availableTags, setAvailableTags] = useState<Tag[]>([])
    const [open, setOpen] = useState(false)
    const [inputValue, setInputValue] = useState('')

    // Cargar tags disponibles (Master List Virtual)
    useEffect(() => {
        if (open) {
            getAllUniqueTags(companyId).then(setAvailableTags)
        }
    }, [open, companyId])

    const handleSelectTag = async (tag: Tag) => {
        // Verificar si ya lo tiene
        if (currentTags.some(t => t.id === tag.id)) return

        try {
            const updated = await addTagToLead(leadId, currentTags, tag)
            if (updated) {
                onUpdate(updated)
                toast.success('Etiqueta agregada')
            }
        } catch (error) {
            console.error(error)
            toast.error('Error agregando etiqueta')
        }
    }

    const handleCreateTag = async () => {
        if (!inputValue.trim()) return

        // Crear nuevo tag con ID random y color random
        const newTag: Tag = {
            id: crypto.randomUUID(),
            name: inputValue.trim(),
            color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]
        }

        try {
            const updated = await addTagToLead(leadId, currentTags, newTag)
            if (updated) {
                onUpdate(updated)
                toast.success('Nueva etiqueta creada y asignada')
                setInputValue('')
                setOpen(false)
            }
        } catch (error) {
            console.error(error)
            toast.error('Error creando etiqueta')
        }
    }

    const handleRemoveTag = async (tagId: string) => {
        try {
            const updated = await removeTagFromLead(leadId, currentTags, tagId)
            if (updated) {
                onUpdate(updated)
            }
        } catch (error) {
            console.error(error)
            toast.error('Error eliminando etiqueta')
        }
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Etiquetas</span>
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full hover:bg-primary/10 hover:text-primary">
                            <Plus size={14} weight="bold" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-56" align="end">
                        <Command>
                            <CommandInput
                                placeholder="Buscar o crear..."
                                value={inputValue}
                                onValueChange={setInputValue}
                            />
                            <CommandList>
                                <CommandEmpty className="p-2">
                                    <div className="text-xs text-muted-foreground mb-2">No existe "{inputValue}"</div>
                                    <Button size="sm" className="w-full text-xs h-7" onClick={handleCreateTag}>
                                        Crear "{inputValue}"
                                    </Button>
                                </CommandEmpty>
                                <CommandGroup heading="Disponibles">
                                    {availableTags.map(tag => {
                                        const isSelected = currentTags.some(t => t.id === tag.id)
                                        return (
                                            <CommandItem
                                                key={tag.id}
                                                onSelect={() => handleSelectTag(tag)}
                                                disabled={isSelected}
                                                className="text-xs"
                                            >
                                                <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: tag.color }} />
                                                {tag.name}
                                                {isSelected && <Check className="ml-auto w-3 h-3 opacity-50" />}
                                            </CommandItem>
                                        )
                                    })}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>

            <div className="flex flex-wrap gap-1.5">
                {currentTags && currentTags.length > 0 ? (
                    currentTags.map(tag => (
                        <Badge
                            key={tag.id}
                            className="text-[10px] font-medium px-2 py-0.5 h-6 gap-1 pr-1 group hover:ring-1 hover:ring-offset-1 transition-all cursor-default"
                            style={{ backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color + '40' }}
                            variant="outline"
                        >
                            {tag.name}
                            <button
                                onClick={() => handleRemoveTag(tag.id)}
                                className="hover:bg-red-500 hover:text-white rounded-full p-0.5 transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <X size={10} weight="bold" />
                            </button>
                        </Badge>
                    ))
                ) : (
                    <div className="text-xs text-muted-foreground italic opacity-60">Sin etiquetas</div>
                )}
            </div>
        </div>
    )
}
