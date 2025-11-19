import { useKV } from '@github/spark/hooks'
import { Task, Lead, Appointment, Notification as NotificationType } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle, Clock, WarningCircle, Plus, Bell, Microphone } from '@phosphor-icons/react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { VoiceRecorder } from './VoiceRecorder'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface DashboardProps {
  onShowNotifications: () => void
}

export function Dashboard({ onShowNotifications }: DashboardProps) {
  const [tasks] = useKV<Task[]>('tasks', [])
  const [leads] = useKV<Lead[]>('leads', [])
  const [appointments] = useKV<Appointment[]>('appointments', [])
  const [notifications] = useKV<NotificationType[]>('notifications', [])
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const myTasks = (tasks || []).filter(t => !t.completed)
  const todayTasks = myTasks.filter(t => {
    const taskDate = new Date(t.dueDate)
    taskDate.setHours(0, 0, 0, 0)
    return taskDate.getTime() === today.getTime()
  })
  const overdueTasks = myTasks.filter(t => new Date(t.dueDate) < today)
  
  const todayAppointments = (appointments || []).filter(a => {
    const apptDate = new Date(a.startTime)
    apptDate.setHours(0, 0, 0, 0)
    return apptDate.getTime() === today.getTime()
  })

  const unreadNotifications = (notifications || []).filter(n => !n.read).length

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-destructive'
      case 'medium': return 'text-warning'
      case 'low': return 'text-muted-foreground'
      default: return 'text-foreground'
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Welcome Back!</h1>
          <p className="text-muted-foreground mt-1">Here's what's happening today</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowVoiceRecorder(true)} variant="outline" size="lg">
            <Microphone className="mr-2" size={20} />
            Voice Task
          </Button>
          <Button onClick={onShowNotifications} variant="outline" size="lg" className="relative">
            <Bell className="mr-2" size={20} />
            Notifications
            {unreadNotifications > 0 && (
              <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                {unreadNotifications}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(leads || []).length}</div>
            <p className="text-xs text-muted-foreground mt-1">Active in pipeline</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today's Tasks</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayTasks.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Due today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <WarningCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{overdueTasks.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Need attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Appointments</CardTitle>
            <CalendarBlank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayAppointments.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Scheduled today</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Today's Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No tasks due today</p>
            ) : (
              todayTasks.slice(0, 5).map(task => (
                <div key={task.id} className="flex items-start gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <CheckCircle size={16} className="mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{task.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={cn('text-xs h-5', getPriorityColor(task.priority))}>
                        {task.priority}
                      </Badge>
                      <span className="text-xs text-muted-foreground truncate">Assigned to: {task.assignedTo}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Appointments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No appointments today</p>
            ) : (
              todayAppointments.map(appt => (
                <div key={appt.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <CalendarBlank size={20} className="mt-0.5 text-primary" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{appt.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{appt.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(appt.startTime), 'h:mm a')} - {format(new Date(appt.endTime), 'h:mm a')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showVoiceRecorder} onOpenChange={setShowVoiceRecorder}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Task with Voice</DialogTitle>
          </DialogHeader>
          <VoiceRecorder onClose={() => setShowVoiceRecorder(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Users(props: any) {
  return <span {...props}>👥</span>
}

function CalendarBlank(props: any) {
  return <span {...props}>📅</span>
}
