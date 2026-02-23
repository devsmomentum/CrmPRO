import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/crm/Sidebar'
import { NotificationPanel } from '@/components/crm/NotificationPanel'
import { useAuth } from '@/hooks/useAuth'
import { useState, useEffect } from 'react'
import { supabase } from '@/supabase/client'
import { getPendingInvitations } from '@/supabase/services/invitations'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Copy } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { preloadChatsForCompany } from '@/lib/chatsCache'
import { useNavigate, useLocation } from 'react-router-dom'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Building } from '@phosphor-icons/react'

interface CRMLayoutProps {
    isGuestMode?: boolean
}

export function CRMLayout({ isGuestMode: forcedGuestMode }: CRMLayoutProps) {
    const {
        user,
        companies,
        currentCompanyId,
        setCurrentCompanyId,
        logout,
        isGuestMode: authGuestMode,
        leaveCompanyHandler,
        fetchCompanies
    } = useAuth()

    const navigate = useNavigate()
    const location = useLocation()
    const [showNotifications, setShowNotifications] = useState(false)
    const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0)

    const isGuestMode = forcedGuestMode ?? authGuestMode
    const currentCompany = companies.find(c => c.id === currentCompanyId)

    // Precargar chats cuando cambia la empresa
    useEffect(() => {
        if (currentCompanyId && user?.id) {
            const timer = setTimeout(() => {
                preloadChatsForCompany(currentCompanyId)
            }, 1000)
            return () => clearTimeout(timer)
        }
    }, [currentCompanyId, user?.id])

    // Sincronizar URL con modo invitado
    useEffect(() => {
        const isUrlGuest = location.pathname.startsWith('/guest')
        const currentPath = location.pathname.replace('/guest', '').replace(/^\//, '') || 'dashboard'

        // Si está en modo invitado pero la URL no tiene /guest, redirigir
        if (authGuestMode && !isUrlGuest) {
            navigate(`/guest/${currentPath}`, { replace: true })
        }
        // Si NO está en modo invitado pero la URL tiene /guest, redirigir
        else if (!authGuestMode && isUrlGuest) {
            navigate(`/${currentPath}`, { replace: true })
        }
    }, [authGuestMode, location.pathname, navigate])

    // Contar notificaciones no leídas
    useEffect(() => {
        if (!user?.email) return

        const fetchNotificationCount = async () => {
            const { count } = await supabase
                .from('notificaciones')
                .select('id', { count: 'exact', head: true })
                .eq('usuario_email', user.email)
                .eq('read', false)
                .in('type', ['lead_assigned', 'invitation_response'])
            setUnreadNotificationsCount(count || 0)
        }

        fetchNotificationCount()

        // Suscripción en tiempo real
        const channel = supabase
            .channel(`noti-counter-${user.email}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'notificaciones',
                filter: `usuario_email=eq.${user.email}`
            }, fetchNotificationCount)
            .subscribe()

        return () => {
            channel.unsubscribe()
        }
    }, [user?.email])

    // Función para manejar cambio de vista
    const handleViewChange = (view: string) => {
        const prefix = isGuestMode ? '/guest' : ''
        const path = view === 'dashboard' ? '' : view
        navigate(`${prefix}/${path}`.replace('//', '/'))
    }

    // Determinar la vista actual basada en la URL
    const getCurrentView = (): string => {
        const path = location.pathname.replace('/guest', '').replace('/', '') || 'dashboard'
        return path
    }

    // Manejar cambio de empresa
    const handleCompanyChange = (companyId: string) => {
        setCurrentCompanyId(companyId)
        const selectedCompany = companies.find(c => c.id === companyId)
        const willBeGuest = selectedCompany && user && selectedCompany.ownerId !== user.id

        // Redirigir a la ruta correcta basada en si será invitado o no
        const currentPath = location.pathname.replace('/guest', '').replace('/', '') || 'dashboard'
        if (willBeGuest) {
            navigate(`/guest/${currentPath}`)
        } else if (location.pathname.startsWith('/guest')) {
            navigate(`/${currentPath}`)
        }
    }

    if (!user) return null

    const role = currentCompany?.ownerId === user.id ? 'Owner' : (currentCompany?.role || 'Viewer')
    const displayRole = role === 'admin' ? 'Admin' : (role === 'owner' || role === 'Owner') ? 'Propietario' : 'Lector'
    const badgeColor = displayRole === 'Propietario' ? 'bg-primary/10 text-primary border-primary/20' : displayRole === 'Admin' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' : 'bg-muted text-muted-foreground border-border'

    return (
        <div className="fixed inset-0 bg-background overflow-hidden flex flex-col md:flex-row">
            <Sidebar
                currentView={getCurrentView()}
                onViewChange={handleViewChange}
                onLogout={logout}
                user={user}
                currentCompanyId={currentCompanyId}
                onCompanyChange={handleCompanyChange}
                companies={companies}
                notificationCount={unreadNotificationsCount}
            />

            <main className="flex-1 flex flex-col overflow-hidden relative pb-20 md:pb-0">
                {/* Guest Mode Banner */}
                {isGuestMode && currentCompany && (
                    <div className="mx-4 mt-4 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
                        <div className="flex items-center gap-4">
                            <Avatar className="w-12 h-12 rounded-2xl border-2 border-amber-200 shadow-sm shrink-0">
                                {currentCompany?.logo ? (
                                    <AvatarImage src={currentCompany.logo} alt={currentCompany.name} className="object-cover" />
                                ) : (
                                    <AvatarFallback className="bg-amber-100 text-amber-700 font-bold">
                                        <Building size={20} />
                                    </AvatarFallback>
                                )}
                            </Avatar>
                            <div>
                                <h4 className="text-amber-900 font-semibold text-sm flex items-center gap-2">
                                    Portal de Invitado
                                    <span className="px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-800 text-[10px] uppercase tracking-wider font-bold">Limitado</span>
                                </h4>
                                <p className="text-amber-800/80 text-xs md:text-sm leading-tight">
                                    Viendo <strong className="text-amber-900">{currentCompany.name}</strong> • Acceso controlado según tu rol.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="flex-1 md:flex-none h-9 bg-white/60 hover:bg-red-50 text-red-700 border border-red-100 rounded-xl text-xs font-medium px-4 transition-all"
                                onClick={() => {
                                    if (confirm('¿Estás seguro de que quieres abandonar esta empresa? Perderás el acceso inmediatamente.')) {
                                        leaveCompanyHandler(currentCompany.id)
                                        navigate('/dashboard')
                                    }
                                }}
                            >
                                Abandonar
                            </Button>
                            <Button
                                variant="default"
                                size="sm"
                                className="flex-1 md:flex-none h-9 bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-200 rounded-xl text-xs font-medium px-4 border-none transition-all"
                                onClick={() => {
                                    const myCompany = companies.find(c => c.ownerId === user.id)
                                    if (myCompany) {
                                        setCurrentCompanyId(myCompany.id)
                                        navigate('/dashboard')
                                        toast.info('Has vuelto a tu empresa personal')
                                    } else {
                                        toast.error('No se encontró tu empresa personal')
                                    }
                                }}
                            >
                                Salir del Modo
                            </Button>
                        </div>
                    </div>
                )}


                {/* Page Content (rendered by Outlet) */}
                <Outlet />
            </main>

            <NotificationPanel open={showNotifications} onClose={() => setShowNotifications(false)} />
        </div>
    )
}
