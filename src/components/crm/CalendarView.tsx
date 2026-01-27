import { useState } from 'react'
import { usePersistentState } from '@/hooks/usePersistentState'
import { Appointment, Lead } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { format, isSameDay } from 'date-fns'
import { Plus, Clock } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { AddAppointmentDialog } from './leads/dialogs/AddAppointmentDialog'

export function CalendarView({ companyId }: { companyId?: string }) {
  const [appointments, setAppointments] = usePersistentState<Appointment[]>(`appointments-${companyId}`, [])
  const [leads] = usePersistentState<Lead[]>(`leads-${companyId}`, [])
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [showAddDialog, setShowAddDialog] = useState(false)

  const dayAppointments = (appointments || []).filter(appt =>
    isSameDay(new Date(appt.startTime), selectedDate)
  )

  const getLeadName = (leadId: string) => {
    return (leads || []).find(l => l.id === leadId)?.name || 'Unknown'
  }

  const handleAddAppointment = (appointment: Appointment) => {
    setAppointments((current) => [...(current || []), appointment])
  }

  return (
    <div className="flex-1 p-4 md:p-8 overflow-y-auto bg-background/50 pb-24 md:pb-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Calendar</h1>
          <p className="text-muted-foreground mt-1">Manage appointments and meetings</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2" size={20} />
          New Appointment
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Select Date</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {format(selectedDate, 'MMMM d, yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dayAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No appointments scheduled
              </p>
            ) : (
              dayAppointments.map(appt => (
                <div key={appt.id} className="p-3 border border-border rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-sm">{appt.title}</h4>
                    <Badge variant={appt.status === 'scheduled' ? 'default' : 'secondary'}>
                      {appt.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{appt.description}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock size={12} />
                    <span>
                      {format(new Date(appt.startTime), 'h:mm a')} -
                      {format(new Date(appt.endTime), 'h:mm a')}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    With: {getLeadName(appt.leadId)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(appointments || [])
              .filter(a => new Date(a.startTime) > new Date())
              .slice(0, 10)
              .map(appt => (
                <div key={appt.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{appt.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(appt.startTime), 'MMM d, yyyy h:mm a')} • {getLeadName(appt.leadId)}
                    </p>
                  </div>
                  <Badge variant={appt.status === 'scheduled' ? 'default' : 'secondary'}>
                    {appt.status}
                  </Badge>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      <AddAppointmentDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={handleAddAppointment}
      />
    </div>
  )
}
