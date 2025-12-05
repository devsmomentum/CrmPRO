import { useKV } from '@github/spark/hooks'
import { Notification as NotificationType } from '@/lib/types'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { CheckCircle, Clock, Bell, ArrowRight } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface NotificationPanelProps {
  open: boolean
  onClose: () => void
}

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const [notifications, setNotifications] = useKV<NotificationType[]>('notifications', [])

  const markAsRead = (id: string) => {
    setNotifications((current) =>
      (current || []).map(n => n.id === id ? { ...n, read: true } : n)
    )
  }

  const markAllAsRead = () => {
    setNotifications((current) =>
      (current || []).map(n => ({ ...n, read: true }))
    )
  }

  const getIcon = (type: NotificationType['type']) => {
    switch (type) {
      case 'task': return Clock
      case 'message': return Bell
      case 'appointment': return CheckCircle
      case 'stage_change': return ArrowRight
      default: return Bell
    }
  }

  return (
    <Sheet open={open} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader className="mb-4">
          <div className="flex items-center justify-between">
            <SheetTitle>Notifications</SheetTitle>
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              Mark all read
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="space-y-3">
            {(notifications || []).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No notifications
              </div>
            ) : (
              (notifications || []).map(notification => {
                const Icon = getIcon(notification.type)
                
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      'p-4 border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors',
                      !notification.read && 'bg-primary/5 border-primary/20'
                    )}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'p-2 rounded-full',
                        !notification.read ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      )}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-medium text-sm">{notification.title}</h4>
                          {!notification.read && (
                            <Badge variant="default" className="ml-2 flex-shrink-0">New</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{notification.message}</p>
                        {(notification as any).data && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {((notification as any).data.empresa_nombre || (notification as any).data.equipo_nombre) && (
                              <div className="flex items-center gap-2">
                                {(notification as any).data.empresa_nombre && (
                                  <span>Empresa: {(notification as any).data.empresa_nombre}</span>
                                )}
                                {(notification as any).data.equipo_nombre && (
                                  <span>Equipo: {(notification as any).data.equipo_nombre}</span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(new Date(notification.timestamp), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
