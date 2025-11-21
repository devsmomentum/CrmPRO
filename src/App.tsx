import { useState, useEffect } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { Sidebar } from '@/components/crm/Sidebar'
import { Dashboard } from '@/components/crm/Dashboard'
import { PipelineView } from '@/components/crm/PipelineView'
import { AnalyticsDashboard } from '@/components/crm/AnalyticsDashboard'
import { CalendarView } from '@/components/crm/CalendarView'
import { TeamView } from '@/components/crm/TeamView'
import { SettingsView } from '@/components/crm/SettingsView'
import { NotificationPanel } from '@/components/crm/NotificationPanel'
import LoginView from '@/components/crm/LoginView'
import { RegisterView } from '@/components/crm/RegisterView'
import { register, login, logout } from '@/supabase/auth'
import { createUsuario, getUsuarioById } from '@/supabase/services/usuarios'
import { createEmpresa, getEmpresasByUsuario } from '@/supabase/services/empresa'
import { supabase } from '@/supabase/client'
// import { useKV } from '@github/spark/hooks'
import { usePersistentState } from '@/hooks/usePersistentState'
import { toast } from 'sonner'
import { Pipeline, PipelineType } from '@/lib/types'
import { Company } from '@/components/crm/CompanyManagement'

type View = 'dashboard' | 'pipeline' | 'analytics' | 'calendar' | 'team' | 'settings'
type AuthView = 'login' | 'register'

interface User {
  id: string
  email: string
  businessName: string // usamos businessName en UI pero se guarda como nombre en tabla usuarios
}

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const [showNotifications, setShowNotifications] = useState(false)
  const [authView, setAuthView] = useState<AuthView>('login')
  const [user, setUser] = usePersistentState<User | null>('current-user', null)
  const [companies, setCompanies] = usePersistentState<Company[]>('companies', [])
  const [currentCompanyId, setCurrentCompanyId] = usePersistentState<string>('current-company-id', '')
  
  const handleLogin = async (email: string, password: string) => {
    try {
      console.log('[LOGIN] iniciando login para', email)
      const authUser = await login(email, password)
      console.log('[LOGIN] authUser recibido', authUser)
      const row = await getUsuarioById(authUser.id)
      console.log('[LOGIN] fila usuarios', row)
      const newUser: User = { id: row.id, email: row.email, businessName: row.nombre }
      setUser(newUser)
      setCompanies([])
      setCurrentCompanyId('')
      toast.success('¡Sesión iniciada exitosamente!')
    } catch (e:any) {
      console.error('[LOGIN] error', e)
      toast.error(e.message || 'Error iniciando sesión')
    }
  }

  const handleRegister = async (email: string, password: string, businessName: string) => {
    try {
      console.log('[REGISTER] iniciando registro para', email)
      const authUser = await register(email, password)
      console.log('[REGISTER] authUser recibido', authUser)
      // Asegurar sesión (si el proyecto requiere confirmación de email, no habrá token todavía)
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        console.log('[REGISTER] no hay sesión inmediata, intentando login para obtener token')
        await login(email, password)
      }
      const { data: sessionAfter } = await supabase.auth.getSession()
      if (!sessionAfter.session) {
        throw new Error('No se pudo obtener sesión tras registro. Verifica si la confirmación de email está habilitada.')
      }
      const row = await createUsuario({ id: authUser.id, email, nombre: businessName })
      console.log('[REGISTER] fila insertada usuarios', row)
      // Crear empresa inicial
      const empresa = await createEmpresa({ nombre_empresa: businessName, usuario_id: authUser.id })
      console.log('[REGISTER] empresa creada', empresa)

      const newUser: User = { id: row.id, email: row.email, businessName: row.nombre }
      setUser(newUser)
      // Map a Company shape para UI
      const uiCompany = {
        id: empresa.id,
        name: empresa.nombre_empresa,
        ownerId: empresa.usuario_id,
        createdAt: new Date(empresa.created_at)
      }
      setCompanies([uiCompany])
      setCurrentCompanyId(uiCompany.id)
      toast.success('¡Cuenta creada exitosamente!')
    } catch (e:any) {
      console.error('[REGISTER] error', e)
      if (e.message?.toLowerCase().includes('429')) {
        toast.error('Demasiados intentos. Espera unos segundos e intenta de nuevo.')
      } else if (e.message?.toLowerCase().includes('401')) {
        toast.error('No autorizado. Puede faltar sesión si la confirmación de email está activada.')
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
      />
      
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="border-b px-4 py-2 text-xs text-muted-foreground flex items-center gap-4">
          <span>Usuario: {user.businessName} ({user.email})</span>
          <span>ID: {user.id}</span>
        </div>
        {currentView === 'dashboard' && <Dashboard key={currentCompanyId} companyId={currentCompanyId} onShowNotifications={() => setShowNotifications(true)} />}
        {currentView === 'pipeline' && <PipelineView key={currentCompanyId} companyId={currentCompanyId} />}
        {currentView === 'analytics' && <AnalyticsDashboard key={currentCompanyId} companyId={currentCompanyId} />}
        {currentView === 'calendar' && <CalendarView key={currentCompanyId} companyId={currentCompanyId} />}
        {currentView === 'team' && <TeamView key={currentCompanyId} companyId={currentCompanyId} />}
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
      </main>

      <NotificationPanel open={showNotifications} onClose={() => setShowNotifications(false)} />
      
      <Toaster />
    </div>
  )
}

export default App