import { supabase } from '@/supabase/client'
import { Appointment } from '@/lib/types'

export interface CreateAppointmentDTO {
    empresa_id: string
    lead_id: string
    team_member_id?: string
    title: string
    description?: string
    start_time: Date
    end_time: Date
    status?: 'scheduled' | 'completed' | 'cancelled'
}

export interface UpdateAppointmentDTO {
    title?: string
    description?: string
    start_time?: Date
    end_time?: Date
    status?: 'scheduled' | 'completed' | 'cancelled'
    lead_id?: string
    team_member_id?: string
}

function mapDBToAppointment(db: any): Appointment {
    return {
        id: db.id,
        leadId: db.lead_id,
        teamMemberId: db.team_member_id || '',
        title: db.title,
        description: db.description || '',
        startTime: new Date(db.start_time),
        endTime: new Date(db.end_time),
        status: db.status as any,
    }
}

export async function getAppointments(empresaId: string): Promise<Appointment[]> {
    const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('start_time', { ascending: true })

    if (error) throw error
    return data.map(mapDBToAppointment)
}

export async function createAppointment(appointment: CreateAppointmentDTO): Promise<Appointment> {
    const { data, error } = await supabase
        .from('appointments')
        .insert({
            empresa_id: appointment.empresa_id,
            lead_id: appointment.lead_id,
            team_member_id: appointment.team_member_id,
            title: appointment.title,
            description: appointment.description,
            start_time: appointment.start_time.toISOString(),
            end_time: appointment.end_time.toISOString(),
            status: appointment.status || 'scheduled'
        })
        .select()
        .single()

    if (error) throw error
    return mapDBToAppointment(data)
}

export async function updateAppointment(id: string, updates: UpdateAppointmentDTO): Promise<Appointment> {
    const dbUpdates: any = {}
    if (updates.title) dbUpdates.title = updates.title
    if (updates.description !== undefined) dbUpdates.description = updates.description
    if (updates.start_time) dbUpdates.start_time = updates.start_time.toISOString()
    if (updates.end_time) dbUpdates.end_time = updates.end_time.toISOString()
    if (updates.status) dbUpdates.status = updates.status
    if (updates.lead_id) dbUpdates.lead_id = updates.lead_id
    if (updates.team_member_id) dbUpdates.team_member_id = updates.team_member_id

    const { data, error } = await supabase
        .from('appointments')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return mapDBToAppointment(data)
}

export async function deleteAppointment(id: string): Promise<void> {
    const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', id)

    if (error) throw error
}
