import { useState } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { Sidebar } from '@/components/crm/Sidebar'
import { Dashboard } from '@/components/crm/Dashboard'
import { PipelineView } from '@/components/crm/PipelineView'
import { AnalyticsDashboard } from '@/components/crm/AnalyticsDashboard'
import { CalendarView } from '@/components/crm/CalendarView'
import { TeamView } from '@/components/crm/TeamView'
import { SettingsView } from '@/components/crm/SettingsView'
import { NotificationPanel } from '@/components/crm/NotificationPanel'

type View = 'dashboard' | 'pipeline' | 'analytics' | 'calendar' | 'team' | 'settings'

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const [showNotifications, setShowNotifications] = useState(false)

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      
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