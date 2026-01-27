import { memo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DotsThree, Note, CalendarBlank, CurrencyDollar } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Lead, Pipeline, PipelineType, TeamMember, Stage } from '@/lib/types'
import { Company } from '@/components/crm/CompanyManagement'

interface User {
    id: string
    email: string
    businessName: string
}

interface LeadCardProps {
    lead: Lead
    stageColor: string
    isHighlighted: boolean
    hasUnreadMessages: boolean
    notesCount: number
    meetingsCount: number
    isAdminOrOwner: boolean
    canEditLeads: boolean
    isMobile: boolean
    currentPipeline?: Pipeline
    teamMembers: TeamMember[]
    currentCompany?: Company
    user?: User | null

    // Callbacks
    onDragStart: (e: React.DragEvent, lead: Lead) => void
    onClick: (lead: Lead) => void
    onDelete: (leadId: string) => void
    onMoveToStage: (lead: Lead, stageId: string) => void
    onOpenMoveDialog: (lead: Lead) => void

    // Helpers
    t: any
}

function LeadCardComponent({
    lead,
    stageColor,
    isHighlighted,
    hasUnreadMessages,
    notesCount,
    meetingsCount,
    isAdminOrOwner,
    canEditLeads,
    isMobile,
    currentPipeline,
    teamMembers,
    currentCompany,
    user,
    onDragStart,
    onClick,
    onDelete,
    onMoveToStage,
    onOpenMoveDialog,
    t
}: LeadCardProps) {

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return 'bg-destructive'
            case 'medium': return 'bg-warning'
            case 'low': return 'bg-muted-foreground'
            default: return 'bg-muted-foreground'
        }
    }

    const getAssignedName = () => {
        const NIL_UUID = '00000000-0000-0000-0000-000000000000'
        const member = teamMembers.find(m => m.id === lead.assignedTo)
        if (member) return member.name
        if (lead.assignedTo === NIL_UUID || lead.assignedTo == null) {
            return 'Todos'
        }
        if (user && user.id === lead.assignedTo) {
            return `${currentCompany?.name || user.businessName || user.email} (Yo)`
        }
        // Si el asignado es el dueño/owner de la empresa, mostrar nombre de la empresa
        if (currentCompany && currentCompany.ownerId === lead.assignedTo) {
            return `${currentCompany.name} (Owner)`
        }
        return 'Sin asignar'
    }

    return (
        <Card
            id={`lead-card-${lead.id}`}
            draggable={canEditLeads}
            onDragStart={(e) => onDragStart(e, lead)}
            className={cn(
                "w-[85vw] sm:w-80 md:w-full shrink-0 p-2 cursor-move hover:shadow-md transition-all border-l-4 active:opacity-50",
                isHighlighted && "ring-2 ring-primary ring-offset-2 animate-pulse",
                !canEditLeads && "cursor-default"
            )}
            style={{ borderLeftColor: stageColor }}
            onClick={() => onClick(lead)}
        >
            <div className="flex items-start justify-between mb-1">
                <div className="flex-1 min-w-0 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm truncate">{lead.name}</h4>
                        <p className="text-xs text-muted-foreground truncate">{lead.company}</p>
                    </div>
                    {hasUnreadMessages && (
                        <div className="w-2 h-2 rounded-full bg-destructive shrink-0 animate-pulse" title="Mensajes no leídos" />
                    )}
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0">
                            <DotsThree size={14} />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem disabled={!isAdminOrOwner}>{t.buttons.edit}</DropdownMenuItem>
                        {isMobile ? (
                            <DropdownMenuItem
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onOpenMoveDialog(lead)
                                }}
                            >
                                Mover a Etapa
                            </DropdownMenuItem>
                        ) : (
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger disabled={!isAdminOrOwner}>Mover a Etapa</DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                    {(currentPipeline?.stages || []).map(s => (
                                        <DropdownMenuItem
                                            key={s.id}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onMoveToStage(lead, s.id)
                                            }}
                                            disabled={s.id === lead.stage}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                                {s.name}
                                            </div>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                        )}
                        {isAdminOrOwner && (
                            <DropdownMenuItem
                                className="text-destructive"
                                onClick={(event) => {
                                    event.stopPropagation()
                                    onDelete(lead.id)
                                }}
                            >
                                {t.buttons.delete}
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="flex items-center gap-1 mb-1">
                <div className={cn('w-2 h-2 rounded-full', getPriorityColor(lead.priority))} />
                <span className="text-xs text-muted-foreground capitalize">{lead.priority}</span>
                {notesCount > 0 && (
                    <TooltipProvider delayDuration={300}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center gap-0.5 ml-1 text-amber-600">
                                    <Note size={12} weight="fill" />
                                    <span className="text-[10px] font-medium">{notesCount}</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                                {notesCount} nota{notesCount > 1 ? 's' : ''}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
                {meetingsCount > 0 && (
                    <TooltipProvider delayDuration={300}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center gap-0.5 ml-1 text-purple-600">
                                    <CalendarBlank size={12} weight="fill" />
                                    <span className="text-[10px] font-medium">{meetingsCount}</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                                {meetingsCount} reunión{meetingsCount > 1 ? 'es' : ''}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>

            {lead.budget > 0 && (
                <div className="flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-500 mb-1">
                    <CurrencyDollar size={14} weight="bold" />
                    <span>${lead.budget.toLocaleString()}</span>
                </div>
            )}

            <div className="flex flex-wrap gap-1 mb-1">
                {lead.tags.slice(0, 2).map(tag => (
                    <Badge
                        key={tag.id}
                        variant="outline"
                        className="text-xs h-4 px-1 max-w-20 truncate"
                        style={{ borderColor: tag.color, color: tag.color }}
                        title={tag.name}
                    >
                        {tag.name}
                    </Badge>
                ))}
                {lead.tags.length > 2 && (
                    <Badge variant="outline" className="text-xs h-4 px-1">
                        +{lead.tags.length - 2}
                    </Badge>
                )}
            </div>

            <div className="pt-1 border-t border-border text-xs text-muted-foreground truncate">
                {t.lead.assignedTo}: {getAssignedName()}
            </div>
        </Card>
    )
}

// Exportamos memoizado para rendimiento en DnD
export const LeadCard = memo(LeadCardComponent)
