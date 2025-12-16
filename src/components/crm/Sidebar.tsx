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
  companies?: Company[]
  notificationCount?: number
}

export function Sidebar({ currentView, onViewChange, onLogout, user, currentCompanyId, onCompanyChange, companies = [], notificationCount = 0 }: SidebarProps) {
  const t = useTranslation('es')
  const [notifications] = usePersistentState<Notification[]>('notifications', [])
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false)
  const [showCompanySelector, setShowCompanySelector] = useState(false)
  // const [companies] = usePersistentState<Company[]>('companies', [])

  const unreadCount = (notifications || []).filter(n => !n.read).length + notificationCount

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
          {user && (companies || []).length > 0 && (
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
                      {c.name} {c.ownerId !== user?.id && <span className="text-muted-foreground text-[10px] ml-1">('Invitado')</span>}
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

          <button
            onClick={() => onViewChange('notifications')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors relative",
              currentView === 'notifications' ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground hover:bg-muted"
            )}
          >
            <Bell size={20} weight={currentView === 'notifications' ? 'fill' : 'regular'} />
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

      <div className="md:hidden fixed bottom-0 left-0 right-0 w-full bg-background border-t border-border z-[9999] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] pb-[env(safe-area-inset-bottom)]">
        <nav className="flex items-center justify-between px-1 py-1.5 overflow-x-auto">
          {/* Botón de empresa */}
          {user && (companies || []).length > 0 && (
            <button
              onClick={() => setShowCompanySelector(true)}
              className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-medium text-muted-foreground min-w-fit"
            >
              <Buildings size={20} />
              <span className="text-[9px] truncate max-w-[40px]">Empresa</span>
            </button>
          )}

          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = currentView === item.id

            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-medium transition-all min-w-fit',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground'
                )}
              >
                <Icon size={20} weight={isActive ? 'fill' : 'regular'} />
                <span className="text-[9px]">{item.label}</span>
              </button>
            )
          })}

          <button
            onClick={() => setShowVoiceRecorder(true)}
            className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-medium text-primary bg-primary/10 min-w-fit"
          >
            <Microphone size={20} weight="fill" />
            <span className="text-[9px]">{t.nav.voice}</span>
          </button>
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

      {/* Dialog para selector de empresa en móvil */}
      <Dialog open={showCompanySelector} onOpenChange={setShowCompanySelector}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Buildings size={20} />
              Cambiar Empresa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {(companies || []).map(c => (
              <button
                key={c.id}
                onClick={() => {
                  onCompanyChange && onCompanyChange(c.id)
                  setShowCompanySelector(false)
                }}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                  currentCompanyId === c.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
              >
                {c.name}
                {c.ownerId !== user?.id && (
                  <span className="text-xs ml-2 opacity-70">('Invitado')</span>
                )}
              </button>
            ))}
          </div>
          <div className="pt-2 mt-2 border-t border-border">
            <button
              onClick={() => {
                onLogout && onLogout()
                setShowCompanySelector(false)
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2"
            >
              <SignOut size={16} />
              Cerrar Sesión
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
