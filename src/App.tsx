import { useState, useEffect } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sidebar } from '@/components/crm/Sidebar'
import { Dashboard } from '@/components/crm/Dashboard'
import { PipelineView } from '@/components/crm/PipelineView'
import { ChatsView } from '@/components/crm/ChatsView'
import { AnalyticsDashboard } from '@/components/crm/AnalyticsDashboard'
import { CalendarView } from '@/components/crm/CalendarView'
import { TeamView } from '@/components/crm/TeamView'
import { SettingsView } from '@/components/crm/SettingsView'
import { NotificationPanel } from '@/components/crm/NotificationPanel'
import { NotificationsView } from '@/components/crm/NotificationsView'
import LoginView from '@/components/crm/LoginView'
import { RegisterView } from '@/components/crm/RegisterView'
import { register, login, logout } from '@/supabase/auth'
import { createUsuario, getUsuarioById } from '@/supabase/services/usuarios'
import { createEmpresa, getEmpresasByUsuario, leaveCompany } from '@/supabase/services/empresa'
import { supabase } from '@/supabase/client'
import { verifyEmpresaTable, testInsertEmpresa, listEmpresasCurrentUser, testRLSViolation } from '@/supabase/diagnostics/empresaDebug'
import { getPendingInvitations } from '@/supabase/services/invitations'
import { usePersistentState } from '@/hooks/usePersistentState'
import { toast } from 'sonner'
import { Pipeline, PipelineType } from '@/lib/types'
import { Company } from '@/components/crm/CompanyManagement'
import { JoinTeam } from '@/components/crm/JoinTeam'
import { preloadChatsForCompany } from '@/lib/chatsCache'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { cn } from '@/lib/utils'
import { Copy } from '@phosphor-icons/react'

type View = 'dashboard' | 'pipeline' | 'chats' | 'analytics' | 'calendar' | 'team' | 'settings' | 'notifications'
type AuthView = 'login' | 'register'

interface User {
  id: string
  email: string
  businessName: string
}

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const [showNotifications, setShowNotifications] = useState(false)
  const [authView, setAuthView] = useState<AuthView>('login')
  const [user, setUser] = usePersistentState<User | null>('current-user', null)
  const [companies, setCompanies] = usePersistentState<Company[]>('companies', [])
  const [currentCompanyId, setCurrentCompanyId] = usePersistentState<string>('current-company-id', '')
  const [pendingInvitationsCount, setPendingInvitationsCount] = useState(0)
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0)
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [isLoggingInForInvite, setIsLoggingInForInvite] = useState(false)

  // Key for storing invite token in localStorage
  const INVITE_TOKEN_KEY = 'pending_invite_token'

  useEffect(() => {
    ; (window as any).empDiag = {
      verifyEmpresaTable,
      testInsertEmpresa,
      listEmpresasCurrentUser,
      testRLSViolation
    }
    console.log('[EMPRESA:DIAG] Herramientas empDiag disponibles en window.empDiag')
  }, [])

  useEffect(() => {
    // Check URL for token first
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    if (urlToken) {
      setInviteToken(urlToken)
      // Also save to localStorage in case user needs to register/confirm email
      localStorage.setItem(INVITE_TOKEN_KEY, urlToken)
    } else {
      // Check if there's a pending invite token in localStorage (from before login/register)
      const storedToken = localStorage.getItem(INVITE_TOKEN_KEY)
      if (storedToken) {
        setInviteToken(storedToken)
      }
    }
  }, [])

  useEffect(() => {
    if (user?.email) {
      getPendingInvitations(user.email)
        .then(invites => setPendingInvitationsCount(invites?.length || 0))
        .catch(err => console.error('Error fetching invitations count:', err))

      // Contar notificaciones no leídas (invitation_response + lead_assigned)
      supabase
        .from('notificaciones')
        .select('id', { count: 'exact', head: true })
        .eq('usuario_email', user.email)
        .eq('read', false)
        .in('type', ['lead_assigned', 'invitation_response'])
        .then(({ count, error }) => {
          if (!error) setUnreadNotificationsCount(count || 0)
        })

      // Suscribirse a cambios para mantener el contador en tiempo real
      const channel = supabase
        .channel(`noti-counter-${user.email}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notificaciones', filter: `usuario_email=eq.${user.email}` }, async () => {
          const { count } = await supabase
            .from('notificaciones')
            .select('id', { count: 'exact', head: true })
            .eq('usuario_email', user.email)
            .eq('read', false)
            .in('type', ['lead_assigned', 'invitation_response'])
          setUnreadNotificationsCount(count || 0)
        })
      channel.subscribe()

      return () => {
        channel.unsubscribe()
      }
    }
  }, [user?.email])

  const fetchCompanies = async () => {
    if (!user?.id) return
    try {
      const empresas = await getEmpresasByUsuario(user.id)
      const uiCompanies = empresas.map(e => ({
        id: e.id,
        name: e.nombre_empresa,
        ownerId: e.usuario_id,
        createdAt: new Date(e.created_at),
        role: e.role, // Pass the role to the UI
        logo: e.logo_url || undefined
      }))
      setCompanies(uiCompanies)

      if (!currentCompanyId && uiCompanies.length > 0) {
        setCurrentCompanyId(uiCompanies[0].id)
      }
      return uiCompanies
    } catch (error) {
      console.error('Error fetching companies:', error)
      return []
    }
  }

  const [authInitialized, setAuthInitialized] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  useEffect(() => {
    // Verificar sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Importante: Marcar como inicializado SIEMPRE, haya sesión o no
      setAuthInitialized(true)
    })

    // Escuchar cambios de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthInitialized(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user?.id && authInitialized) {
      fetchCompanies()
    }
  }, [user?.id, authInitialized])

  // Precargar chats en segundo plano cuando cambia la empresa
  useEffect(() => {
    if (currentCompanyId && user?.id) {
      // Pequeño delay para no interferir con la carga inicial del Dashboard
      const timer = setTimeout(() => {
        preloadChatsForCompany(currentCompanyId)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [currentCompanyId, user?.id])

  const handleLogin = async (email: string, password: string) => {
    try {
      setIsLoggingIn(true)
      console.log('[LOGIN] iniciando login para', email)
      const authUser = await login(email, password)
      console.log('[LOGIN] authUser recibido', authUser)

      let row
      try {
        row = await getUsuarioById(authUser.id)
      } catch (err: any) {
        console.log('[LOGIN] usuario no existe en tabla usuarios, creando...')
        row = await createUsuario({
          id: authUser.id,
          email: authUser.email || email,
          nombre: authUser.email?.split('@')[0] || 'Usuario'
        })
      }

      console.log('[LOGIN] fila usuarios', row)
      const newUser: User = { id: row.id, email: row.email, businessName: row.nombre }
      setUser(newUser)

      const empresas = await getEmpresasByUsuario(authUser.id)
      const uiCompanies = empresas.map(e => ({
        id: e.id,
        name: e.nombre_empresa,
        ownerId: e.usuario_id,
        createdAt: new Date(e.created_at),
        role: e.role,
        logo: e.logo_url || undefined
      }))
      setCompanies(uiCompanies)
      if (uiCompanies.length > 0) {
        setCurrentCompanyId(uiCompanies[0].id)
      }

      if (uiCompanies.length === 0) {
        console.log('[LOGIN] No se encontraron empresas; creando empresa inicial')
        try {
          const empresaCreada = await createEmpresa({ nombre_empresa: row.nombre, usuario_id: authUser.id })
          console.log('[LOGIN] Empresa inicial creada en login', empresaCreada)
          const nuevaCompany = {
            id: empresaCreada.id,
            name: empresaCreada.nombre_empresa,
            ownerId: empresaCreada.usuario_id,
            createdAt: new Date(empresaCreada.created_at),
            role: 'owner'
          }
          setCompanies([nuevaCompany])
          setCurrentCompanyId(nuevaCompany.id)
        } catch (err: any) {
          console.error('[LOGIN] Error creando empresa inicial en login', err)
        }
      }

      // UX: Esperar para mostrar la pantalla de carga de forma agradable
      await new Promise(resolve => setTimeout(resolve, 1500))
      setIsLoggingIn(false)
      toast.success('¡Sesión iniciada exitosamente!')
    } catch (e: any) {
      setIsLoggingIn(false)
      console.error('[LOGIN] error', e)
      if (e.message?.toLowerCase().includes('email not confirmed')) {
        toast.error('Por favor confirma tu email antes de iniciar sesión. Revisa tu bandeja de entrada.', {
          duration: 6000
        })
      } else {
        toast.error(e.message || 'Error iniciando sesión')
      }
    }
  }

  const handleRegister = async (email: string, password: string, businessName: string) => {
    try {
      console.log('[REGISTER] iniciando registro para', email)
      const authUser = await register(email, password)
      console.log('[REGISTER] authUser recibido', authUser)

      const { data: sessionData } = await supabase.auth.getSession()

      if (!sessionData.session) {
        console.log('[REGISTER] confirmación de email requerida')
        toast.success('¡Registro exitoso! Por favor revisa tu email para confirmar tu cuenta.', {
          duration: 6000
        })
        setAuthView('login')
        return
      }

      const row = await createUsuario({ id: authUser.id, email, nombre: businessName })
      console.log('[REGISTER] fila insertada usuarios', row)

      const empresa = await createEmpresa({ nombre_empresa: businessName, usuario_id: authUser.id })
      console.log('[REGISTER] empresa creada', empresa)

      const newUser: User = { id: row.id, email: row.email, businessName: row.nombre }
      setUser(newUser)

      const uiCompany = {
        id: empresa.id,
        name: empresa.nombre_empresa,
        ownerId: empresa.usuario_id,
        createdAt: new Date(empresa.created_at)
      }
      setCompanies([uiCompany])
      setCurrentCompanyId(uiCompany.id)
      toast.success('¡Cuenta creada exitosamente!')
    } catch (e: any) {
      console.error('[REGISTER] error', e)
      if (e.message?.toLowerCase().includes('429')) {
        toast.error('Demasiados intentos. Espera unos segundos e intenta de nuevo.')
      } else if (e.message?.toLowerCase().includes('email not confirmed')) {
        toast.info('Por favor confirma tu email antes de iniciar sesión. Revisa tu bandeja de entrada.', {
          duration: 6000
        })
      } else {
        toast.error(e.message || 'Error registrando usuario')
      }
    }
  }

  const handleLogout = async () => {
    await logout()
    setUser(null)
    setCurrentCompanyId('')
    toast.success('¡Sesión cerrada!')
  }

  if (!authInitialized || isLoggingIn) {
    return <LoadingScreen />
  }

  if (inviteToken) {
    if (user) {
      return (
        <>
          <JoinTeam
            token={inviteToken}
            user={user}
            onSuccess={async () => {
              // Recargar empresas para mostrar la nueva empresa invitada
              await fetchCompanies()
              setInviteToken(null)
              // Clear from localStorage as well
              localStorage.removeItem(INVITE_TOKEN_KEY)
              window.history.replaceState({}, document.title, window.location.pathname)
              setCurrentView('dashboard')
              toast.success('¡Te has unido exitosamente! Ahora puedes ver la empresa desde el selector.')
            }}
            onLoginRequest={() => { }}
          />
          <Toaster />
        </>
      )
    }

    if (isLoggingInForInvite) {
      return (
        <>
          {authView === 'login' ? (
            <LoginView
              onLogin={handleLogin}
              onSwitchToRegister={() => setAuthView('register')}
            />
          ) : (
            <RegisterView
              onRegister={handleRegister}
              onSwitchToLogin={() => setAuthView('login')}
            />
          )}
          <Toaster />
        </>
      )
    } else {
      return (
        <>
          <JoinTeam
            token={inviteToken}
            user={null}
            onSuccess={() => { }}
            onLoginRequest={() => setIsLoggingInForInvite(true)}
          />
          <Toaster />
        </>
      )
    }
  }

  if (!user) {
    return (
      <>
        {authView === 'login' ? (
          <LoginView
            onLogin={handleLogin}
            onSwitchToRegister={() => setAuthView('register')}
          />
        ) : (
          <RegisterView
            onRegister={handleRegister}
            onSwitchToLogin={() => setAuthView('login')}
          />
        )}
        <Toaster />
      </>
    )
  }

  return (
    <div className="fixed inset-0 bg-background overflow-hidden flex flex-col md:flex-row">
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        onLogout={handleLogout}
        user={user}
        currentCompanyId={currentCompanyId}
        onCompanyChange={setCurrentCompanyId}
        companies={companies}
        notificationCount={unreadNotificationsCount}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative pb-20 md:pb-0">
        {(() => {
          const currentCompany = companies.find(c => c.id === currentCompanyId)
          const isGuest = currentCompany && currentCompany.ownerId !== user.id

          if (isGuest) {
            return (
              <div className="mx-4 mt-4 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-amber-200/50 flex items-center justify-center shrink-0">
                    <span className="text-amber-700 text-xl">✨</span>
                  </div>
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
                    onClick={async () => {
                      if (confirm('¿Estás seguro de que quieres abandonar esta empresa? Perderás el acceso inmediatamente.')) {
                        try {
                          await leaveCompany(currentCompany.id, user.email, user.id)
                          toast.success('Has abandonado la empresa correctamente')
                          const myCompany = companies.find(c => c.ownerId === user.id)
                          if (myCompany) {
                            setCurrentCompanyId(myCompany.id)
                            setCurrentView('dashboard')
                          }
                          fetchCompanies()
                        } catch (error) {
                          console.error('Error leaving company:', error)
                          toast.error('Error al abandonar la empresa')
                        }
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
                      console.log('[GUEST_MODE] Saliendo del modo invitado...')
                      const myCompany = companies.find(c => c.ownerId === user.id)
                      if (myCompany) {
                        setCurrentCompanyId(myCompany.id)
                        setCurrentView('dashboard')
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
            )
          }
          return null
        })()}

        <div className="mt-auto border-t bg-muted/20 px-6 py-3 flex items-center gap-4 transition-all animate-in fade-in slide-in-from-bottom-2 duration-700">
          <div className="flex items-center gap-4 group cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-background border-2 border-border shadow-sm flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform duration-300">
              <img
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.businessName || user.email)}`}
                alt={user.businessName}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-foreground tracking-tight">
                  {user.businessName || 'Mi Perfil'}
                </span>
                {(() => {
                  const currentCompany = companies.find(c => c.id === currentCompanyId)
                  const role = currentCompany?.ownerId === user.id ? 'Owner' : (currentCompany?.role || 'Viewer')
                  const displayRole = role === 'admin' ? 'Admin' : (role === 'owner' || role === 'Owner') ? 'Propietario' : 'Lector'
                  const badgeColor = displayRole === 'Propietario' ? 'bg-primary/10 text-primary border-primary/20' : displayRole === 'Admin' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' : 'bg-muted text-muted-foreground border-border'

                  return (
                    <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest px-1.5 py-0 h-4 border shadow-none", badgeColor)}>
                      {displayRole}
                    </Badge>
                  )
                })()}
              </div>
              <span className="text-[11px] font-bold text-muted-foreground opacity-70">{user.email}</span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 leading-none">ID Personal</span>
              <div
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-background border border-border/50 hover:bg-muted/50 hover:border-primary/20 transition-all cursor-copy group/id"
                onClick={() => {
                  navigator.clipboard.writeText(user.id)
                  toast.success('ID copiado al portapapeles')
                }}
              >
                <code className="text-[10px] font-black text-muted-foreground font-mono group-hover/id:text-primary transition-colors">
                  {user.id.slice(0, 8)}...{user.id.slice(-4)}
                </code>
                <Copy size={12} className="text-muted-foreground/40 group-hover/id:text-primary transition-colors" weight="bold" />
              </div>
            </div>
          </div>
        </div>
        {currentView === 'dashboard' && <Dashboard key={currentCompanyId} companyId={currentCompanyId} onShowNotifications={() => setShowNotifications(true)} />}
        {currentView === 'pipeline' && <PipelineView key={currentCompanyId} companyId={currentCompanyId} companies={companies} user={user} />}
        {currentView === 'chats' && <ChatsView companyId={currentCompanyId} canDeleteLead={(function () {
          const currentCompany = companies.find(c => c.id === currentCompanyId)
          const isOwner = currentCompany?.ownerId === user.id
          const isAdmin = (currentCompany?.role || '').toLowerCase() === 'admin'
          return !!(isOwner || isAdmin)
        })()} onNavigateToPipeline={(leadId) => {
          sessionStorage.setItem('openLeadId', leadId)
          setCurrentView('pipeline')
        }} />}
        {currentView === 'analytics' && <AnalyticsDashboard key={currentCompanyId} companyId={currentCompanyId} />}
        {currentView === 'calendar' && <CalendarView key={currentCompanyId} companyId={currentCompanyId} />}
        {currentView === 'team' && <TeamView key={currentCompanyId} companyId={currentCompanyId} companies={companies} currentUserId={user.id} currentUserEmail={user.email} />}
        {currentView === 'settings' && (
          <SettingsView
            key={currentCompanyId}
            currentUserId={user.id}
            currentCompanyId={currentCompanyId}
            onCompanyChange={setCurrentCompanyId}
            companies={companies}
            setCompanies={setCompanies}
            onLogout={handleLogout}
          />
        )}
        {currentView === 'notifications' && (
          <NotificationsView
            onInvitationAccepted={async (newCompanyId) => {
              await fetchCompanies()
              if (newCompanyId) {
                setCurrentCompanyId(newCompanyId)
              }
              if (user?.email) {
                try {
                  const invites = await getPendingInvitations(user.email)
                  setPendingInvitationsCount(invites?.length || 0)
                  // Recontar no leídas al salir
                  const { count } = await supabase
                    .from('notificaciones')
                    .select('id', { count: 'exact', head: true })
                    .eq('usuario_email', user.email)
                    .eq('read', false)
                  setUnreadNotificationsCount(count || 0)
                } catch (err) {
                  console.error('Error refreshing invitations count:', err)
                }
              }
              setCurrentView('dashboard')
            }}
          />
        )}
      </main>

      <NotificationPanel open={showNotifications} onClose={() => setShowNotifications(false)} />

      <Toaster />
    </div>
  )
}

export default App