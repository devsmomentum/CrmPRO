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
import { LoginView } from '@/components/crm/LoginView'
import { RegisterView } from '@/components/crm/RegisterView'
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
  businessName: string
}

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const [showNotifications, setShowNotifications] = useState(false)
  const [authView, setAuthView] = useState<AuthView>('login')
  const [user, setUser] = usePersistentState<User | null>('current-user', null)
  const [companies, setCompanies] = usePersistentState<Company[]>('companies', [])
  const [currentCompanyId, setCurrentCompanyId] = usePersistentState<string>('current-company-id', '')
  
  const handleLogin = (email: string, password: string) => {
    const newUser: User = {
      id: Date.now().toString(),
      email,
      businessName: ''
    }
    
    setUser(newUser)
    setCompanies([])
    setCurrentCompanyId('')
    toast.success('¡Sesión iniciada exitosamente!')
  }

  const handleRegister = (email: string, password: string, businessName: string) => {
    const newUser: User = {
      id: Date.now().toString(),
      email,
      businessName
    }
    
    const newCompany: Company = {
      id: Date.now().toString(),
      name: businessName,
      ownerId: newUser.id,
      createdAt: new Date()
    }
    
    setUser(newUser)
    setCompanies([newCompany])
    setCurrentCompanyId(newCompany.id)
    toast.success('¡Cuenta creada exitosamente!')
  }

  const handleLogout = () => {
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