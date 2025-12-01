import { useState, useEffect } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sidebar } from '@/components/crm/Sidebar'
import { Dashboard } from '@/components/crm/Dashboard'
import { PipelineView } from '@/components/crm/PipelineView'
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
import { createEmpresa, getEmpresasByUsuario } from '@/supabase/services/empresa'
import { supabase } from '@/supabase/client'
import { verifyEmpresaTable, testInsertEmpresa, listEmpresasCurrentUser, testRLSViolation } from '@/supabase/diagnostics/empresaDebug'
import { getPendingInvitations } from '@/supabase/services/invitations'
import { usePersistentState } from '@/hooks/usePersistentState'
import { toast } from 'sonner'
import { Pipeline, PipelineType } from '@/lib/types'
import { Company } from '@/components/crm/CompanyManagement'
import { JoinTeam } from '@/components/crm/JoinTeam'

type View = 'dashboard' | 'pipeline' | 'analytics' | 'calendar' | 'team' | 'settings' | 'notifications'
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
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [isLoggingInForInvite, setIsLoggingInForInvite] = useState(false)

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
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token) {
      setInviteToken(token)
    }
  }, [])

  useEffect(() => {
    if (user?.email) {
      getPendingInvitations(user.email)
        .then(invites => setPendingInvitationsCount(invites?.length || 0))
        .catch(err => console.error('Error fetching invitations count:', err))
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
        role: e.role // Pass the role to the UI
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

  useEffect(() => {
    if (user?.id) {
      fetchCompanies()
    }
  }, [user?.id])

  const handleLogin = async (email: string, password: string) => {
    try {
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
        role: e.role
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

      toast.success('¡Sesión iniciada exitosamente!')
    } catch (e: any) {
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
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        onLogout={handleLogout}
        user={user}
        currentCompanyId={currentCompanyId}
        onCompanyChange={setCurrentCompanyId}
        companies={companies}
        notificationCount={pendingInvitationsCount}
      />

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {(() => {
          const currentCompany = companies.find(c => c.id === currentCompanyId)
          const isGuest = currentCompany && currentCompany.ownerId !== user.id

          if (isGuest) {
            return (
              <div className="bg-amber-100 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-amber-900 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Modo Invitado:</span>
                  <span>Estás viendo la empresa <strong>{currentCompany.name}</strong>. Tienes acceso de lectura/escritura limitado según tu rol.</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 bg-white border-amber-300 hover:bg-amber-50 text-amber-900"
                  onClick={() => {
                    console.log('[GUEST_MODE] Saliendo del modo invitado...')
                    const myCompany = companies.find(c => c.ownerId === user.id)
                    if (myCompany) {
                      setCurrentCompanyId(myCompany.id)
                      setCurrentView('dashboard')
                      toast.info('Has vuelto a tu empresa')
                    } else {
                      toast.error('No se encontró tu empresa personal')
                    }
                  }}
                >
                  Salir del Modo Invitado
                </Button>
              </div>
            )
          }
          return null
        })()}

        <div className="border-b px-4 py-2 text-xs text-muted-foreground flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center overflow-hidden">
              <img
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.businessName || user.email)}`}
                alt={user.businessName}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="leading-none">
              <div className="text-sm font-medium text-foreground flex items-center gap-2">
                {user.businessName}
                {(() => {
                  const currentCompany = companies.find(c => c.id === currentCompanyId)
                  const role = currentCompany?.ownerId === user.id ? 'Owner' : (currentCompany?.role || 'Viewer')
                  const displayRole = role === 'admin' ? 'Admin' : (role === 'owner' || role === 'Owner') ? 'Owner' : 'Viewer'
                  const badgeColor = displayRole === 'Owner' ? 'border-primary text-primary' : displayRole === 'Admin' ? 'border-blue-500 text-blue-500' : 'border-muted-foreground text-muted-foreground'
                  
                  return (
                    <Badge variant="outline" className={`text-[10px] h-4 px-1 py-0 ${badgeColor}`}>
                      {displayRole}
                    </Badge>
                  )
                })()}
              </div>
              <div className="text-[11px] text-muted-foreground">{user.email}</div>
            </div>
          </div>
          <div className="ml-auto text-[11px] text-muted-foreground">ID: <span className="font-mono text-[11px] text-foreground">{user.id}</span></div>
        </div>
        {currentView === 'dashboard' && <Dashboard key={currentCompanyId} companyId={currentCompanyId} onShowNotifications={() => setShowNotifications(true)} />}
        {currentView === 'pipeline' && <PipelineView key={currentCompanyId} companyId={currentCompanyId} companies={companies} />}
        {currentView === 'analytics' && <AnalyticsDashboard key={currentCompanyId} companyId={currentCompanyId} />}
        {currentView === 'calendar' && <CalendarView key={currentCompanyId} companyId={currentCompanyId} />}
        {currentView === 'team' && <TeamView key={currentCompanyId} companyId={currentCompanyId} companies={companies} currentUserId={user.id} />}
        {currentView === 'settings' && (
          <SettingsView
            key={currentCompanyId}
            currentUserId={user.id}
            currentCompanyId={currentCompanyId}
            onCompanyChange={setCurrentCompanyId}
            companies={companies}
            setCompanies={setCompanies}
          />
        )}
        {currentView === 'notifications' && (
          <NotificationsView
            onInvitationAccepted={async (newCompanyId) => {
              await fetchCompanies()
              if (newCompanyId) {
                setCurrentCompanyId(newCompanyId)
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