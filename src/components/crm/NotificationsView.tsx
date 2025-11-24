import { useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Bell, Check, X, Buildings, User, Clock } from '@phosphor-icons/react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'

// Mock data for invitations
interface Invitation {
    id: string
    companyName: string
    companyLogo?: string
    inviterName: string
    inviterEmail: string
    role: string
    sentAt: Date
    status: 'pending' | 'accepted' | 'rejected'
}

const MOCK_INVITATIONS: Invitation[] = [
    {
        id: '1',
        companyName: 'TechCorp Solutions',
        inviterName: 'Roberto Gómez',
        inviterEmail: 'roberto@techcorp.com',
        role: 'Sales Manager',
        sentAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        status: 'pending'
    },
    {
        id: '2',
        companyName: 'Innovate Design',
        inviterName: 'Ana Martínez',
        inviterEmail: 'ana@innovate.com',
        role: 'Marketing Specialist',
        sentAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
        status: 'pending'
    }
]

export function NotificationsView() {
    const t = useTranslation('es')
    const [invitations, setInvitations] = useState<Invitation[]>(MOCK_INVITATIONS)

    const handleAccept = (id: string) => {
        setInvitations(current =>
            current.map(inv => inv.id === id ? { ...inv, status: 'accepted' } : inv)
        )
        toast.success('Invitación aceptada', {
            description: 'Ahora tienes acceso a la empresa.'
        })
    }

    const handleReject = (id: string) => {
        setInvitations(current =>
            current.map(inv => inv.id === id ? { ...inv, status: 'rejected' } : inv)
        )
        toast.info('Invitación rechazada')
    }

    const pendingInvitations = invitations.filter(i => i.status === 'pending')

    return (
        <div className="flex-1 p-4 md:p-8 overflow-y-auto bg-background/50">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-primary/10 rounded-full">
                        <Bell size={24} className="text-primary" weight="fill" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Notificaciones</h1>
                        <p className="text-muted-foreground">Gestiona tus invitaciones y alertas.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        Invitaciones de Equipo
                        {pendingInvitations.length > 0 && (
                            <Badge variant="secondary" className="ml-2">
                                {pendingInvitations.length} pendientes
                            </Badge>
                        )}
                    </h2>

                    {pendingInvitations.length === 0 ? (
                        <Card className="bg-muted/30 border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="p-4 bg-muted rounded-full mb-4">
                                    <Buildings size={32} className="text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-medium">No tienes invitaciones pendientes</h3>
                                <p className="text-sm text-muted-foreground max-w-sm mt-2">
                                    Cuando alguien te invite a unirse a su equipo o empresa, aparecerá aquí.
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {pendingInvitations.map((invitation) => (
                                <Card key={invitation.id} className="overflow-hidden transition-all hover:shadow-md border-l-4 border-l-primary">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between p-6 gap-4">
                                        <div className="flex items-start gap-4">
                                            <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                                                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                                    {invitation.companyName.substring(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>

                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-lg">{invitation.companyName}</h3>
                                                    <Badge variant="outline" className="text-xs font-normal">
                                                        {invitation.role}
                                                    </Badge>
                                                </div>

                                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm text-muted-foreground">
                                                    <div className="flex items-center gap-1">
                                                        <User size={14} />
                                                        <span>Invitado por <span className="font-medium text-foreground">{invitation.inviterName}</span></span>
                                                    </div>
                                                    <span className="hidden sm:inline">•</span>
                                                    <div className="flex items-center gap-1">
                                                        <Clock size={14} />
                                                        <span>{format(invitation.sentAt, "d 'de' MMMM, HH:mm", { locale: es })}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 pt-2 md:pt-0 pl-16 md:pl-0">
                                            <Button
                                                variant="outline"
                                                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => handleReject(invitation.id)}
                                            >
                                                <X className="mr-2" size={16} />
                                                Rechazar
                                            </Button>
                                            <Button
                                                onClick={() => handleAccept(invitation.id)}
                                                className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                                            >
                                                <Check className="mr-2" size={16} />
                                                Aceptar Invitación
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>

                {/* Historial de invitaciones (opcional, para dar más cuerpo a la vista) */}
                {(invitations.length > pendingInvitations.length) && (
                    <div className="space-y-4 pt-8 border-t">
                        <h2 className="text-lg font-semibold text-muted-foreground">Historial reciente</h2>
                        <div className="space-y-2 opacity-70">
                            {invitations.filter(i => i.status !== 'pending').map(inv => (
                                <div key={inv.id} className="flex items-center justify-between p-4 bg-muted/20 rounded-lg border border-transparent hover:border-border transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-2 h-2 rounded-full",
                                            inv.status === 'accepted' ? "bg-green-500" : "bg-red-500"
                                        )} />
                                        <span className="font-medium">{inv.companyName}</span>
                                        <span className="text-sm text-muted-foreground">- {inv.role}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground capitalize">
                                        {inv.status === 'accepted' ? 'Aceptada' : 'Rechazada'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function cn(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(' ')
}
