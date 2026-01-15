import { useState, useEffect, useRef } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Lead } from '@/lib/types'
import { MagnifyingGlass, User, Phone, Buildings, Trash, Spinner } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/use-mobile' // Assuming we might have or can make a debounce hook, or just inline it

interface LeadSearchDialogProps {
    leads?: Lead[]
    onSelectLead: (lead: Lead) => void
    canDelete?: boolean
    onDeleteLeads?: (ids: string[]) => Promise<void>
    onSearch?: (term: string) => Promise<Lead[]>
}

export function LeadSearchDialog({ leads = [], onSelectLead, canDelete, onDeleteLeads, onSearch }: LeadSearchDialogProps) {
    const [open, setOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set())
    const [isDeleting, setIsDeleting] = useState(false)
    const [searchResults, setSearchResults] = useState<Lead[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const searchTimeoutRef = useRef<NodeJS.Timeout>()

    // Local filtering fallback
    const localFilteredLeads = leads.filter(lead => {
        if (!searchTerm.trim() || onSearch) return false

        const search = searchTerm.toLowerCase()
        return (
            (lead.name || '').toLowerCase().includes(search) ||
            (lead.email || '').toLowerCase().includes(search) ||
            (lead.phone || '').toLowerCase().includes(search) ||
            (lead.company || '').toLowerCase().includes(search)
        )
    })

    const displayLeads = onSearch ? searchResults : localFilteredLeads

    useEffect(() => {
        if (!onSearch) return

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current)
        }

        if (!searchTerm.trim()) {
            setSearchResults([])
            return
        }

        setIsSearching(true)
        searchTimeoutRef.current = setTimeout(async () => {
            try {
                const results = await onSearch(searchTerm)
                setSearchResults(results)
            } catch (error) {
                console.error("Error searching leads:", error)
            } finally {
                setIsSearching(false)
            }
        }, 500)

        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
        }
    }, [searchTerm, onSearch])


    const handleSelectLead = (lead: Lead) => {
        setOpen(false)
        setSearchTerm('')
        setSearchResults([])
        onSelectLead(lead)
    }

    const toggleSelection = (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        const next = new Set(selectedLeads)
        if (next.has(id)) {
            next.delete(id)
        } else {
            next.add(id)
        }
        setSelectedLeads(next)
    }

    const handleSelectAll = () => {
        const allFilteredIds = displayLeads.map(l => l.id)
        const allSelected = allFilteredIds.every(id => selectedLeads.has(id))
        
        const next = new Set(selectedLeads)
        if (allSelected) {
            allFilteredIds.forEach(id => next.delete(id))
        } else {
            allFilteredIds.forEach(id => next.add(id))
        }
        setSelectedLeads(next)
    }

    const handleDeleteSelected = async () => {
        if (selectedLeads.size === 0 || !onDeleteLeads) return
        
        if (!confirm(`¿Estás seguro de que deseas eliminar ${selectedLeads.size} leads seleccionados? Esta acción no se puede deshacer.`)) {
            return
        }

        setIsDeleting(true)
        try {
            await onDeleteLeads(Array.from(selectedLeads))
            setSelectedLeads(new Set())
            // If local, filtered list updates automatically via parent props triggering re-render
            // If remote, we should remove them from results manually to feel responsive
            if (onSearch) {
                setSearchResults(prev => prev.filter(l => !selectedLeads.has(l.id)))
            }
            toast.success(`Se eliminaron ${selectedLeads.size} leads`)
        } catch (error) {
            console.error(error)
            toast.error('Error al eliminar leads')
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(true)}
                className="gap-2"
            >
                <MagnifyingGlass size={18} />
                <span className="hidden sm:inline">Buscar Lead</span>
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Buscar Leads</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="relative">
                            <MagnifyingGlass className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nombre, email, teléfono o empresa..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                                autoFocus
                            />
                            {isSearching && (
                                <div className="absolute right-3 top-3">
                                    <Spinner className="animate-spin h-4 w-4 text-primary" />
                                </div>
                            )}
                        </div>

                        {canDelete && displayLeads.length > 0 && (
                            <div className="flex items-center justify-between px-2 py-2 bg-muted/50 rounded-md">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        checked={displayLeads.length > 0 && displayLeads.every(l => selectedLeads.has(l.id))}
                                        onCheckedChange={handleSelectAll}
                                        id="select-all"
                                    />
                                    <label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer select-none">
                                        Seleccionar todos ({displayLeads.length})
                                    </label>
                                </div>
                                {selectedLeads.size > 0 && (
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        className="h-7 text-xs px-2"
                                        onClick={handleDeleteSelected}
                                        disabled={isDeleting}
                                    >
                                        <Trash className="mr-1.5 w-3.5 h-3.5" />
                                        Eliminar ({selectedLeads.size})
                                    </Button>
                                )}
                            </div>
                        )}

                        <div className="max-h-[400px] overflow-y-auto space-y-2">
                            {searchTerm.trim() === '' ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <MagnifyingGlass size={48} className="mx-auto mb-3 opacity-50" />
                                    <p>Escribe para buscar leads</p>
                                </div>
                            ) : displayLeads.length === 0 && !isSearching ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <p>No se encontraron resultados</p>
                                    <p className="text-sm mt-1">Prueba con otro término de búsqueda</p>
                                </div>
                            ) : (
                                displayLeads.map(lead => (
                                    <div
                                        key={lead.id}
                                        onClick={() => handleSelectLead(lead)}
                                        className="w-full text-left p-4 rounded-lg border border-border hover:border-primary hover:bg-muted/50 transition-all overflow-hidden group cursor-pointer"
                                    >
                                        <div className="flex items-start gap-3">
                                            {canDelete && (
                                                <div 
                                                    className="pt-1 pr-2 flex items-center justify-center shrink-0" 
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <Checkbox 
                                                        checked={selectedLeads.has(lead.id)}
                                                        onCheckedChange={(checked) => {
                                                            const next = new Set(selectedLeads)
                                                            if (checked) next.add(lead.id)
                                                            else next.delete(lead.id)
                                                            setSelectedLeads(next)
                                                        }}
                                                    />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0 space-y-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <User size={16} className="text-muted-foreground shrink-0" />
                                                    <span className="font-semibold line-clamp-2 text-balance-any flex-1 min-w-0" title={lead.name}>{lead.name}</span>
                                                    <Badge variant={
                                                        lead.priority === 'high' ? 'destructive' :
                                                            lead.priority === 'medium' ? 'default' : 'secondary'
                                                    } className="shrink-0 text-xs">
                                                        {lead.priority === 'high' ? 'Alta' : lead.priority === 'medium' ? 'Media' : 'Baja'}
                                                    </Badge>
                                                </div>

                                                {lead.company && (
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                                                        <Buildings size={14} className="shrink-0" />
                                                        <span className="line-clamp-1 text-balance-any flex-1 min-w-0" title={lead.company}>{lead.company}</span>
                                                    </div>
                                                )}

                                                {lead.phone && (
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        <Phone size={14} className="shrink-0" />
                                                        <span>{lead.phone}</span>
                                                    </div>
                                                )}

                                                {lead.budget && lead.budget > 0 && (
                                                    <div className="text-sm font-medium text-green-600">
                                                        💰 ${lead.budget.toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {filteredLeads.length > 0 && (
                            <div className="text-xs text-center text-muted-foreground pt-2 border-t">
                                {filteredLeads.length} resultado{filteredLeads.length !== 1 ? 's' : ''} encontrado{filteredLeads.length !== 1 ? 's' : ''}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
