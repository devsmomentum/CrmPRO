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

import { getPendingInvitations, acceptInvitation, rejectInvitation } from '@/supabase/services/invitations'
import { supabase } from '@/supabase/client'
import { useEffect } from 'react'

interface Invitation {
    id: string
    empresa_id: string
    empresa: { nombre_empresa: string }
    equipo: { nombre_equipo: string }
    invited_email: string
    invited_nombre: string
    invited_titulo_trabajo: string
    created_at: string
    status: 'pending' | 'accepted' | 'rejected'
}

interface NotificationsViewProps {
    onInvitationAccepted?: (companyId?: string) => void
}

export function NotificationsView({ onInvitationAccepted }: NotificationsViewProps) {
    const t = useTranslation('es')
    const [invitations, setInvitations] = useState<Invitation[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadInvitations = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (user && user.email) {
                    const data = await getPendingInvitations(user.email)
                    setInvitations(data)
                }
            } catch (error) {
                console.error('Error loading invitations:', error)
            } finally {
                setLoading(false)
            }
        }
        loadInvitations()
    }, [])

    const handleAccept = async (id: string, token: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('No authenticated user')

            const result = await acceptInvitation(token, user.id)
            setInvitations(current => current.filter(inv => inv.id !== id))
            toast.success('Invitación aceptada', {
                description: 'Ahora tienes acceso a la empresa.'
            })

            // Notificar al padre para actualizar estado y navegar
            if (onInvitationAccepted) {
                const acceptedInvite = invitations.find(i => i.id === id)
                onInvitationAccepted(acceptedInvite?.empresa_id)
            }
        } catch (error: any) {
            console.error('Error accepting invitation:', error)
            toast.error('Error al aceptar invitación: ' + error.message)
        }
    }

    const handleReject = async (id: string) => {
        try {
            await rejectInvitation(id)
            setInvitations(current => current.filter(inv => inv.id !== id))
            toast.info('Invitación rechazada')
        } catch (error: any) {
            console.error('Error rejecting invitation:', error)
            toast.error('Error al rechazar invitación')
        }
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
                                                    {invitation.empresa?.nombre_empresa?.substring(0, 2).toUpperCase() || 'EM'}
                                                </AvatarFallback>
                                            </Avatar>

                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-lg">{invitation.empresa?.nombre_empresa || 'Empresa'}</h3>
                                                    <Badge variant="outline" className="text-xs font-normal">
                                                        {invitation.invited_titulo_trabajo || 'Miembro'}
                                                    </Badge>
                                                </div>

                                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm text-muted-foreground">
                                                    <div className="flex items-center gap-1">
                                                        <User size={14} />
                                                        <span>Equipo: <span className="font-medium text-foreground">{invitation.equipo?.nombre_equipo || 'General'}</span></span>
                                                    </div>
                                                    <span className="hidden sm:inline">•</span>
                                                    <div className="flex items-center gap-1">
                                                        <Clock size={14} />
                                                        <span>{format(new Date(invitation.created_at), "d 'de' MMMM, HH:mm", { locale: es })}</span>
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
                                                onClick={() => handleAccept(invitation.id, (invitation as any).token)}
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
                {/* Eliminado historial mock por ahora */}
            </div>
        </div>
    )
}

function cn(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(' ')
}
