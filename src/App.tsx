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
import { useKV } from '@github/spark/hooks'
import { toast } from 'sonner'
import { Pipeline, PipelineType } from '@/lib/types'

type View = 'dashboard' | 'pipeline' | 'analytics' | 'calendar' | 'team' | 'settings'
type AuthView = 'login' | 'register'

interface User {
  id: string
  email: string
  businessName: string
}

interface Business {
  id: string
  name: string
  ownerId: string
}

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const [showNotifications, setShowNotifications] = useState(false)
  const [authView, setAuthView] = useState<AuthView>('login')
  const [user, setUser] = useKV<User | null>('current-user', null)
  const [businesses, setBusinesses] = useKV<Business[]>('businesses', [])
  const [currentBusinessId, setCurrentBusinessId] = useKV<string>('current-business-id', '')
  const [pipelines, setPipelines] = useKV<Pipeline[]>('pipelines', [])
  
  useEffect(() => {
    if ((pipelines || []).length === 0) {
      const defaultPipelines: Pipeline[] = [
        {
          id: 'sales-pipeline',
          name: 'Sales Pipeline',
          type: 'sales',
          stages: [
            { id: 'lead', name: 'Lead', order: 0, color: '#3b82f6', pipelineType: 'sales' },
            { id: 'qualified', name: 'Qualified', order: 1, color: '#8b5cf6', pipelineType: 'sales' },
            { id: 'proposal', name: 'Proposal', order: 2, color: '#ec4899', pipelineType: 'sales' },
            { id: 'negotiation', name: 'Negotiation', order: 3, color: '#f59e0b', pipelineType: 'sales' },
            { id: 'won', name: 'Won', order: 4, color: '#10b981', pipelineType: 'sales' }
          ]
        },
        {
          id: 'support-pipeline',
          name: 'Support Pipeline',
          type: 'support',
          stages: [
            { id: 'new', name: 'New', order: 0, color: '#3b82f6', pipelineType: 'support' },
            { id: 'in-progress', name: 'In Progress', order: 1, color: '#f59e0b', pipelineType: 'support' },
            { id: 'resolved', name: 'Resolved', order: 2, color: '#10b981', pipelineType: 'support' }
          ]
        },
        {
          id: 'administrative-pipeline',
          name: 'Administrative Pipeline',
          type: 'administrative',
          stages: [
            { id: 'pending', name: 'Pending', order: 0, color: '#3b82f6', pipelineType: 'administrative' },
            { id: 'review', name: 'Review', order: 1, color: '#8b5cf6', pipelineType: 'administrative' },
            { id: 'completed', name: 'Completed', order: 2, color: '#10b981', pipelineType: 'administrative' }
          ]
        }
      ]
      
      setPipelines(defaultPipelines)
    }
  }, [])

  const handleLogin = (email: string, password: string) => {
    const newUser: User = {
      id: Date.now().toString(),
      email,
      businessName: 'Mi Empresa'
    }
    
    const newBusiness: Business = {
      id: Date.now().toString(),
      name: 'Mi Empresa',
      ownerId: newUser.id
    }
    
    setUser(newUser)
    setBusinesses([newBusiness])
    setCurrentBusinessId(newBusiness.id)
    toast.success('¡Sesión iniciada exitosamente!')
  }

  const handleRegister = (email: string, password: string, businessName: string) => {
    const newUser: User = {
      id: Date.now().toString(),
      email,
      businessName
    }
    
    const newBusiness: Business = {
      id: Date.now().toString(),
      name: businessName,
      ownerId: newUser.id
    }
    
    setUser(newUser)
    setBusinesses([newBusiness])
    setCurrentBusinessId(newBusiness.id)
    toast.success('¡Cuenta creada exitosamente!')
  }

  const handleLogout = () => {
    setUser(null)
    setCurrentBusinessId('')
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
      />
      
      <main className="flex-1 overflow-auto">
        {currentView === 'dashboard' && <Dashboard onShowNotifications={() => setShowNotifications(true)} />}
        {currentView === 'pipeline' && <PipelineView />}
        {currentView === 'analytics' && <AnalyticsDashboard />}
        {currentView === 'calendar' && <CalendarView />}
        {currentView === 'team' && <TeamView />}
        {currentView === 'settings' && <SettingsView />}
      </main>

      <NotificationPanel open={showNotifications} onClose={() => setShowNotifications(false)} />
      
      <Toaster />
    </div>
  )
}

export default App