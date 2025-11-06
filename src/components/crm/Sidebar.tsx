import { House, Kanban, ChartBar, CalendarBlank, Users, Gear, Bell } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { useKV } from '@github/spark/hooks'
import { Notification } from '@/lib/types'

interface SidebarProps {
  currentView: string
  onViewChange: (view: any) => void
}

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const [notifications] = useKV<Notification[]>('notifications', [])
  
  const unreadCount = (notifications || []).filter(n => !n.read).length

  const menuItems = [
    { id: 'dashboard', icon: House, label: 'Dashboard' },
    { id: 'pipeline', icon: Kanban, label: 'Pipeline' },
    { id: 'analytics', icon: ChartBar, label: 'Analytics' },
    { id: 'calendar', icon: CalendarBlank, label: 'Calendar' },
    { id: 'team', icon: Users, label: 'Team' },
    { id: 'settings', icon: Gear, label: 'Settings' },
  ]

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col">
      <div className="p-6 border-b border-border">
        <h1 className="text-2xl font-bold text-primary">CRM Pro</h1>
        <p className="text-xs text-muted-foreground mt-1">Business Management</p>
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

      <div className="p-4 border-t border-border">
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors relative">
          <Bell size={20} />
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-auto pulse-notification">
              {unreadCount}
            </Badge>
          )}
        </button>
      </div>
    </div>
  )
}
