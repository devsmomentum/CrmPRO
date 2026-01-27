/**
 * OverviewTab Component
 * 
 * Muestra información general del lead: asignación, presupuesto,
 * fechas y actividad reciente.
 * Extraído de LeadDetailSheet para mantener el código organizado.
 */

import { Lead, Message, Channel, TeamMember } from '@/lib/types'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { InlineEdit } from '../InlineEdit'
import { safeFormatDate } from '@/hooks/useDateFormat'
import {
    WhatsappLogo,
    TelegramLogo,
    InstagramLogo,
    FacebookLogo,
    EnvelopeSimple,
    Phone
} from '@phosphor-icons/react'

interface User {
    id: string
    email: string
    businessName: string
}

interface OverviewTabProps {
    lead: Lead
    teamMembers: TeamMember[]
    currentUser?: User | null
    assignedTo: string | null
    onUpdateAssignedTo: (value: string) => void
    onUpdateField: (field: keyof Lead, value: string | number) => void
    recentMessages: Message[]
    canEdit: boolean
    maxBudget: number
    translations: {
        assignedTo: string
        budget: string
        createdAt: string
        lastContact: string
    }
}

// Iconos de canal
const channelIcons = {
    whatsapp: WhatsappLogo,
    telegram: TelegramLogo,
    instagram: InstagramLogo,
    facebook: FacebookLogo,
    email: EnvelopeSimple,
    phone: Phone
}

function getChannelIcon(channel: Channel) {
    return channelIcons[channel] || EnvelopeSimple
}

export function OverviewTab({
    lead,
    teamMembers,
    currentUser,
    assignedTo,
    onUpdateAssignedTo,
    onUpdateField,
    recentMessages,
    canEdit,
    maxBudget,
    translations: t
}: OverviewTabProps) {
    return (
        <div className="flex-1 px-4 sm:px-6 py-4 sm:py-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <Label className="text-xs text-muted-foreground">{t.assignedTo}</Label>
                    <div className="mt-1">
                        <Select value={assignedTo || 'todos'} onValueChange={onUpdateAssignedTo} disabled={!canEdit}>
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos</SelectItem>
                                {currentUser && (
                                    <SelectItem value={currentUser.id}>
                                        {`${currentUser.businessName || currentUser.email || 'Yo'} (Yo)`}
                                    </SelectItem>
                                )}
                                {teamMembers.map(m => (
                                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div>
                    <Label className="text-xs text-muted-foreground">{t.budget}</Label>
                    <div className="mt-1">
                        <InlineEdit
                            value={lead.budget}
                            onSave={(value) => onUpdateField('budget', value)}
                            type="number"
                            min={0}
                            max={maxBudget}
                            prefix="$"
                            displayClassName="font-medium text-primary !m-0 !p-0 hover:bg-transparent justify-start w-auto"
                            disabled={!canEdit}
                        />
                    </div>
                </div>
                <div>
                    <Label className="text-xs text-muted-foreground">{t.createdAt}</Label>
                    <p className="font-medium mt-1">{safeFormatDate(lead.createdAt, 'MMM d, yyyy')}</p>
                </div>
                <div>
                    <Label className="text-xs text-muted-foreground">{t.lastContact}</Label>
                    <p className="font-medium mt-1">
                        {lead.lastContact ? safeFormatDate(lead.lastContact, 'MMM d, yyyy') : 'No contactado'}
                    </p>
                </div>
            </div>

            <Separator />

            <div>
                <h3 className="font-semibold mb-3">Actividad Reciente</h3>
                <div className="space-y-2">
                    {recentMessages.slice(-3).map(msg => {
                        const Icon = getChannelIcon(msg.channel)
                        return (
                            <div key={msg.id} className="text-sm p-2 bg-muted rounded">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-muted-foreground">
                                        <Icon size={14} />
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {safeFormatDate(msg.timestamp, 'MMM d, h:mm a')}
                                    </span>
                                </div>
                                <p>{msg.content}</p>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
