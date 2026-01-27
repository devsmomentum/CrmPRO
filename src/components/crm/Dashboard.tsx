import { usePersistentState } from '@/hooks/usePersistentState'
import { Task, Lead, Meeting, Notification as NotificationType } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle, Clock, WarningCircle, Plus, Bell, Microphone, Users, CalendarBlank, Funnel } from '@phosphor-icons/react'
import { format, isToday, isBefore, isAfter, startOfDay } from 'date-fns'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { VoiceRecorder } from './VoiceRecorder'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getLeads, getLeadsCount } from '@/supabase/services/leads'
import { getPipelines } from '@/supabase/helpers/pipeline'
import { getCompanyMeetings } from '@/supabase/services/reuniones'

interface DashboardProps {
  companyId?: string
  onShowNotifications: () => void
  onNavigateToLead?: (leadId: string) => void
}

export function Dashboard({ companyId, onShowNotifications, onNavigateToLead }: DashboardProps) {
  const [tasks] = usePersistentState<Task[]>(`tasks-${companyId}`, [])
  // const [leads, setLeads] = usePersistentState<Lead[]>(`leads-${companyId}`, [])
  const [leadsCount, setLeadsCount] = useState(0)
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [notifications] = usePersistentState<NotificationType[]>(`notifications-${companyId}`, [])
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false)
  const [pipelinesCount, setPipelinesCount] = useState(0)

  useEffect(() => {
    if (companyId) {
      // Cargar leads count
      getLeadsCount(companyId)
        .then((count: any) => {
          setLeadsCount(count || 0)
        })
        .catch(err => console.error('Error fetching leads count in Dashboard:', err))

      // Cargar pipelines para contar
      getPipelines(companyId)
        .then(({ data }) => {
          if (data) setPipelinesCount(data.length)
        })
        .catch(err => console.error('Error fetching pipelines in Dashboard:', err))

      // Cargar reuniones de la empresa
      getCompanyMeetings(companyId)
        .then(data => {
          setMeetings(data)
        })
        .catch(err => console.error('Error fetching meetings in Dashboard:', err))
    }
  }, [companyId])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const myTasks = (tasks || []).filter(t => !t.completed)
  const todayTasks = myTasks.filter(t => {
    const taskDate = new Date(t.dueDate)
    taskDate.setHours(0, 0, 0, 0)
    return taskDate.getTime() === today.getTime()
  })
  const overdueTasks = myTasks.filter(t => new Date(t.dueDate) < today)

  // Filtrar reuniones
  const todayStart = startOfDay(today)
  const todayEnd = new Date(today)
  todayEnd.setHours(23, 59, 59, 999)

  const todayMeetings = meetings.filter(m => {
    const mDate = new Date(m.date)
    return isToday(mDate)
  })

  const expiredMeetings = meetings.filter(m => {
    const mDate = new Date(m.date)
    return isBefore(mDate, todayStart)
  })

  // Ordenar reuniones de hoy por hora
  todayMeetings.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Ordenar reuniones vencidas (más recientes primero)
  expiredMeetings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const unreadNotifications = (notifications || []).filter(n => !n.read).length

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-destructive'
      case 'medium': return 'text-warning'
      case 'low': return 'text-muted-foreground'
      default: return 'text-foreground'
    }
  }

  const formatTime = (dateStr: string | Date) => {
    try {
      return format(new Date(dateStr), 'h:mm a')
    } catch {
      return ''
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 md:pb-8 space-y-8 bg-background/50">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
            ¡Bienvenido!
          </h1>
          <p className="text-muted-foreground font-medium">Esto es lo que está sucediendo hoy en tu negocio</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowVoiceRecorder(true)}
            variant="outline"
            className="h-10 px-4 gap-2 rounded-xl border-primary/20 hover:bg-primary/5 hover:border-primary/40 transition-all font-semibold"
          >
            <Microphone size={20} weight="duotone" className="text-primary" />
            <span className="hidden sm:inline">Voice Task</span>
          </Button>
          <Button
            onClick={onShowNotifications}
            className="h-10 px-4 gap-2 rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all font-semibold relative"
          >
            <Bell size={20} weight="fill" />
            <span className="hidden sm:inline">Notificaciones</span>
            {unreadNotifications > 0 && (
              <Badge variant="destructive" className="absolute -top-1.5 -right-1.5 h-5 min-w-[20px] px-1 flex items-center justify-center bg-red-500 border-2 border-background text-[10px] font-bold">
                {unreadNotifications}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card className="border-none shadow-sm bg-gradient-to-br from-blue-500/10 to-transparent hover:shadow-md transition-shadow rounded-2xl overflow-hidden relative group">
          <div className="absolute top-[-10px] right-[-10px] opacity-10 group-hover:scale-110 transition-transform">
            <Funnel size={80} weight="fill" className="text-blue-500" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-blue-600/80">Pipelines</CardTitle>
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Funnel size={18} className="text-blue-600" weight="bold" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{pipelinesCount}</div>
            <p className="text-xs font-medium text-muted-foreground mt-1">Pipelines configurados</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-gradient-to-br from-purple-500/10 to-transparent hover:shadow-md transition-shadow rounded-2xl overflow-hidden relative group">
          <div className="absolute top-[-10px] right-[-10px] opacity-10 group-hover:scale-110 transition-transform">
            <Users size={80} weight="fill" className="text-purple-500" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-purple-600/80">Total Leads</CardTitle>
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Users size={18} className="text-purple-600" weight="bold" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{leadsCount}</div>
            <p className="text-xs font-medium text-muted-foreground mt-1">Leads en seguimiento</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-gradient-to-br from-emerald-500/10 to-transparent hover:shadow-md transition-shadow rounded-2xl overflow-hidden relative group">
          <div className="absolute top-[-10px] right-[-10px] opacity-10 group-hover:scale-110 transition-transform">
            <Clock size={80} weight="fill" className="text-emerald-500" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-emerald-600/80">Tareas Hoy</CardTitle>
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Clock size={18} className="text-emerald-600" weight="bold" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{todayTasks.length}</div>
            <p className="text-xs font-medium text-muted-foreground mt-1">Pendientes por completar</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-gradient-to-br from-rose-500/10 to-transparent hover:shadow-md transition-shadow rounded-2xl overflow-hidden relative group">
          <div className="absolute top-[-10px] right-[-10px] opacity-10 group-hover:scale-110 transition-transform">
            <WarningCircle size={80} weight="fill" className="text-rose-500" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-rose-600/80">Vencidas</CardTitle>
            <div className="p-2 bg-rose-500/10 rounded-lg">
              <WarningCircle size={18} className="text-rose-600" weight="bold" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-rose-600">{overdueTasks.length}</div>
            <p className="text-xs font-medium text-muted-foreground mt-1">Requieren atención urgente</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-2 gap-8 h-auto">
        {/* Tareas de Hoy */}
        <Card className="border-none shadow-sm rounded-2xl min-h-[300px]">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl font-bold">Tareas de Hoy</CardTitle>
              <p className="text-xs text-muted-foreground">Tus objetivos para este día</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center">
              <CheckCircle size={22} className="text-primary" weight="duotone" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {todayTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 opacity-60">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <CheckCircle size={32} className="text-muted-foreground" weight="thin" />
                </div>
                <div>
                  <p className="font-bold text-lg">¡Todo al día!</p>
                  <p className="text-sm text-muted-foreground">No tienes tareas pendientes para hoy</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {todayTasks.slice(0, 5).map(task => (
                  <div key={task.id} className="group flex items-center gap-4 p-4 rounded-xl border border-transparent bg-muted/30 hover:bg-muted/50 transition-all hover:translate-x-1">
                    <div className="w-2 h-10 rounded-full bg-primary/20 group-hover:bg-primary transition-colors" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[15px] truncate">{task.title}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <Badge variant="outline" className={cn('text-[10px] h-5 px-1.5 uppercase font-bold tracking-tighter border-none bg-background/50', getPriorityColor(task.priority))}>
                          {task.priority === 'high' ? 'Alta Prioridad' : task.priority === 'medium' ? 'Media' : 'Baja'}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium">
                          <Users size={12} weight="bold" /> {task.assignedTo}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reuniones de Hoy */}
        <Card className="border-none shadow-sm rounded-2xl min-h-[300px]">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl font-bold">Próximas Citas</CardTitle>
              <p className="text-xs text-muted-foreground">Tu agenda para el día actual</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center">
              <CalendarBlank size={22} className="text-primary" weight="duotone" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {todayMeetings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 opacity-60">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <CalendarBlank size={32} className="text-muted-foreground" weight="thin" />
                </div>
                <div>
                  <p className="font-bold text-lg">Agenda despejada</p>
                  <p className="text-sm text-muted-foreground">No hay citas programadas para hoy</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {todayMeetings.map(meeting => (
                  <div key={meeting.id} className="flex flex-col gap-2 p-4 rounded-xl border border-transparent bg-muted/30 hover:bg-muted/50 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-background flex flex-col items-center justify-center shadow-sm border border-muted-foreground/10 shrink-0">
                        <span className="text-[10px] font-bold text-primary uppercase leading-none">{format(new Date(meeting.date), 'MMM')}</span>
                        <span className="text-lg font-black leading-none mt-0.5">{format(new Date(meeting.date), 'd')}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[15px] truncate">{meeting.title}</p>
                        <p className="text-[11px] text-primary font-bold mt-1 flex items-center gap-1.5">
                          <Clock size={12} weight="bold" />
                          {formatTime(meeting.date)} ({meeting.duration} min)
                        </p>
                      </div>
                    </div>
                    {/* Sección de participantes / asignados */}
                    {meeting.participants && meeting.participants.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 pl-16">
                        {meeting.participants.map(p => (
                          <Badge key={p.id} variant="secondary" className="text-[10px] h-5 px-1.5 bg-background border border-border/50">
                            <Users size={10} className="mr-1 opacity-70" /> {p.name}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {onNavigateToLead && (
                      <div className="mt-2 flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] text-muted-foreground hover:text-primary"
                          onClick={() => onNavigateToLead(meeting.leadId)}
                        >
                          Ver Lead
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reuniones Vencidas */}
        {expiredMeetings.length > 0 && (
          <Card className="border-none shadow-sm rounded-2xl min-h-[300px] lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl font-bold text-muted-foreground">Reuniones Anteriores</CardTitle>
                <p className="text-xs text-muted-foreground">Historial reciente de citas pasadas</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-muted/20 flex items-center justify-center">
                <Clock size={22} className="text-muted-foreground" weight="duotone" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {expiredMeetings.slice(0, 6).map(meeting => (
                  <div key={meeting.id} className="flex flex-col gap-2 p-3 rounded-xl border border-border/40 bg-background/40 opacity-70 hover:opacity-100 transition-all">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-sm truncate">{meeting.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {format(new Date(meeting.date), 'MMM d, h:mm a')}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[9px] uppercase tracking-wider">
                        Finalizada
                      </Badge>
                    </div>
                    {meeting.participants && meeting.participants.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {meeting.participants.slice(0, 2).map(p => (
                          <div key={p.id} className="text-[10px] text-muted-foreground flex items-center gap-1 bg-muted/50 px-1.5 py-0.5 rounded-md">
                            <Users size={10} /> {p.name}
                          </div>
                        ))}
                        {meeting.participants.length > 2 && (
                          <span className="text-[10px] text-muted-foreground">+{meeting.participants.length - 2}</span>
                        )}
                        {onNavigateToLead && (
                          <div className="mt-1 flex justify-end w-full">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-2 text-[9px] text-muted-foreground hover:text-primary"
                              onClick={() => onNavigateToLead(meeting.leadId)}
                            >
                              Ir al lead
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showVoiceRecorder} onOpenChange={setShowVoiceRecorder}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Microphone size={24} className="text-primary" weight="duotone" />
              Crear tarea con voz
            </DialogTitle>
          </DialogHeader>
          <VoiceRecorder onClose={() => setShowVoiceRecorder(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

