import { useState } from 'react'
import { House, Kanban, ChartBar, CalendarBlank, Users, Gear, Bell, SignOut, Microphone, Buildings } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
// import { useKV } from '@github/spark/hooks'
import { usePersistentState } from '@/hooks/usePersistentState'
import { Notification } from '@/lib/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { VoiceRecorder } from './VoiceRecorder'
import { useTranslation } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Company } from './CompanyManagement'

interface User {
  id: string
  email: string
  businessName: string
}

interface SidebarProps {
  currentView: string
  onViewChange: (view: any) => void
  onLogout?: () => void
  user?: User
  currentCompanyId?: string
  onCompanyChange?: (companyId: string) => void
}

export function Sidebar({ currentView, onViewChange, onLogout, user, currentCompanyId, onCompanyChange }: SidebarProps) {
  const t = useTranslation('es')
  const [notifications] = usePersistentState<Notification[]>('notifications', [])
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false)
  const [companies] = usePersistentState<Company[]>('companies', [])
  
  const unreadCount = (notifications || []).filter(n => !n.read).length

  const menuItems = [
    { id: 'dashboard', icon: House, label: t.nav.dashboard },
    { id: 'pipeline', icon: Kanban, label: t.nav.pipeline },
    { id: 'analytics', icon: ChartBar, label: t.nav.analytics },
    { id: 'calendar', icon: CalendarBlank, label: t.nav.calendar },
    { id: 'team', icon: Users, label: t.nav.team },
    { id: 'settings', icon: Gear, label: t.nav.settings },
  ]

  return (
    <>
      <div className="hidden md:flex md:w-64 bg-card border-r border-border flex-col">
        <div className="p-6 border-b border-border space-y-2">
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            {t.app.title}
          </h1>
          <p className="text-xs text-muted-foreground">{t.app.subtitle}</p>
          {user && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Buildings size={12} /> Empresa Activa
              </label>
              <Select
                value={currentCompanyId || ''}
                onValueChange={(val) => onCompanyChange && onCompanyChange(val)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Seleccionar empresa" />
                </SelectTrigger>
                <SelectContent>
                  {(companies || []).map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = currentView === item.id
              
              return (
                <li key={item.id}>
                  <button
                    onClick={() => onViewChange(item.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    <Icon size={20} weight={isActive ? 'fill' : 'regular'} />
                    <span>{item.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-border space-y-2">
          <button 
            onClick={() => setShowVoiceRecorder(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Microphone size={20} />
            <span>{t.nav.voice}</span>
          </button>
          
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors relative">
            <Bell size={20} />
            <span>{t.nav.notifications}</span>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-auto pulse-notification">
                {unreadCount}
              </Badge>
            )}
          </button>
          
          {onLogout && (
            <button 
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <SignOut size={20} />
              <span>{t.auth.logout}</span>
            </button>
          )}
        </div>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
        <nav className="flex items-center justify-around p-2">
          {menuItems.slice(0, 4).map((item) => {
            const Icon = item.icon
            const isActive = currentView === item.id
            
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground'
                )}
              >
                <Icon size={24} weight={isActive ? 'fill' : 'regular'} />
                <span className="text-[10px]">{item.label}</span>
              </button>
            )
          })}
          
          <button
            onClick={() => setShowVoiceRecorder(true)}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium text-primary bg-primary/10"
          >
            <Microphone size={24} weight="fill" />
            <span className="text-[10px]">{t.nav.voice}</span>
          </button>
          
          {menuItems.slice(4).map((item) => {
            const Icon = item.icon
            const isActive = currentView === item.id
            
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground'
                )}
              >
                <Icon size={24} weight={isActive ? 'fill' : 'regular'} />
                <span className="text-[10px]">{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
      
      <Dialog open={showVoiceRecorder} onOpenChange={setShowVoiceRecorder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.nav.voice}</DialogTitle>
          </DialogHeader>
          <VoiceRecorder onClose={() => setShowVoiceRecorder(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}
