import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Lead } from '@/lib/types'
import { MagnifyingGlass, User, Phone, Buildings } from '@phosphor-icons/react'

interface LeadSearchDialogProps {
    leads: Lead[]
    onSelectLead: (lead: Lead) => void
}

export function LeadSearchDialog({ leads, onSelectLead }: LeadSearchDialogProps) {
    const [open, setOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')

    const filteredLeads = leads.filter(lead => {
        if (!searchTerm.trim()) return false

        const search = searchTerm.toLowerCase()
        return (
            lead.name?.toLowerCase().includes(search) ||
            lead.email?.toLowerCase().includes(search) ||
            lead.phone?.toLowerCase().includes(search) ||
            lead.company?.toLowerCase().includes(search)
        )
    })

    const handleSelectLead = (lead: Lead) => {
        setOpen(false)
        setSearchTerm('')
        onSelectLead(lead)
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
                        </div>

                        <div className="max-h-[400px] overflow-y-auto space-y-2">
                            {searchTerm.trim() === '' ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <MagnifyingGlass size={48} className="mx-auto mb-3 opacity-50" />
                                    <p>Escribe para buscar leads</p>
                                </div>
                            ) : filteredLeads.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <p>No se encontraron resultados</p>
                                    <p className="text-sm mt-1">Prueba con otro término de búsqueda</p>
                                </div>
                            ) : (
                                filteredLeads.map(lead => (
                                    <button
                                        key={lead.id}
                                        onClick={() => handleSelectLead(lead)}
                                        className="w-full text-left p-4 rounded-lg border border-border hover:border-primary hover:bg-muted/50 transition-all"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0 space-y-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <User size={16} className="text-muted-foreground shrink-0" />
                                                    <span className="font-semibold truncate" title={lead.name}>{lead.name}</span>
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
                                                        <span className="truncate" title={lead.company}>{lead.company}</span>
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
                                    </button>
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
