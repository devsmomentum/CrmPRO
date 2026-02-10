/**
 * Appointments Service
 * Uses the existing lead_reuniones and lead_reunion_participantes tables
 */

import { supabase } from '@/supabase/client'
import { Appointment } from '@/lib/types'

export interface CreateAppointmentDTO {
    empresa_id: string
    lead_id: string
    created_by?: string
    title: string
    description?: string
    start_time: Date
    end_time: Date
    status?: 'scheduled' | 'completed' | 'cancelled'
    participants?: string[]
    notes?: string
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

function mapDBToAppointment(db: any, participantNames: string[] = []): Appointment {
    // Calculate duration in minutes from fecha + duracion_minutos
    const startTime = new Date(db.fecha)
    const endTime = new Date(startTime.getTime() + (db.duracion_minutos || 30) * 60000)

    return {
        id: db.id,
        leadId: db.lead_id,
        teamMemberId: db.created_by || '',
        title: db.titulo,
        description: db.notas || '',
        startTime,
        endTime,
        status: 'scheduled' as any, // lead_reuniones doesn't have a status column
        participants: participantNames,
        notes: db.notas || ''
    }
}

export async function getAppointments(empresaId: string): Promise<Appointment[]> {
    const { data, error } = await supabase
        .from('lead_reuniones')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('fecha', { ascending: true })

    if (error) throw error

    // Fetch participants for all reuniones
    const reunionIds = (data || []).map(r => r.id)
    let participantsMap: Record<string, string[]> = {}

    if (reunionIds.length > 0) {
        const { data: participants } = await supabase
            .from('lead_reunion_participantes')
            .select('reunion_id, nombre')
            .in('reunion_id', reunionIds)

        if (participants) {
            for (const p of participants) {
                if (!participantsMap[p.reunion_id]) {
                    participantsMap[p.reunion_id] = []
                }
                participantsMap[p.reunion_id].push(p.nombre)
            }
        }
    }

    return (data || []).map(d => mapDBToAppointment(d, participantsMap[d.id] || []))
}

export async function createAppointment(appointment: CreateAppointmentDTO): Promise<Appointment> {
    // Calculate duration in minutes from start_time and end_time
    const durationMinutes = Math.round(
        (appointment.end_time.getTime() - appointment.start_time.getTime()) / 60000
    )

    // Insert into lead_reuniones
    const { data, error } = await supabase
        .from('lead_reuniones')
        .insert({
            empresa_id: appointment.empresa_id,
            lead_id: appointment.lead_id,
            created_by: appointment.created_by || null,
            titulo: appointment.title,
            fecha: appointment.start_time.toISOString(),
            duracion_minutos: durationMinutes || 30,
            notas: appointment.notes || null
        })
        .select()
        .single()

    if (error) throw error

    // Insert participants into lead_reunion_participantes
    const participantNames = appointment.participants || []
    if (participantNames.length > 0 && data) {
        const participantRows = participantNames.map(nombre => ({
            reunion_id: data.id,
            nombre,
            tipo: 'external'
        }))

        const { error: partError } = await supabase
            .from('lead_reunion_participantes')
            .insert(participantRows)

        if (partError) {
            console.error('Error inserting participants:', partError)
            // Don't throw - the reunion was created, participants are secondary
        }
    }

    return mapDBToAppointment(data, participantNames)
}

export async function updateAppointment(id: string, updates: UpdateAppointmentDTO): Promise<Appointment> {
    const dbUpdates: any = {}
    if (updates.title) dbUpdates.titulo = updates.title
    if (updates.description !== undefined) dbUpdates.notas = updates.description
    if (updates.start_time) {
        dbUpdates.fecha = updates.start_time.toISOString()
        if (updates.end_time) {
            dbUpdates.duracion_minutos = Math.round(
                (updates.end_time.getTime() - updates.start_time.getTime()) / 60000
            )
        }
    }
    if (updates.lead_id) dbUpdates.lead_id = updates.lead_id

    const { data, error } = await supabase
        .from('lead_reuniones')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single()

    if (error) throw error

    // Fetch participants
    const { data: participants } = await supabase
        .from('lead_reunion_participantes')
        .select('nombre')
        .eq('reunion_id', id)

    const names = (participants || []).map(p => p.nombre)
    return mapDBToAppointment(data, names)
}

export async function deleteAppointment(id: string): Promise<void> {
    // Participants are deleted by CASCADE (foreign key constraint)
    const { error } = await supabase
        .from('lead_reuniones')
        .delete()
        .eq('id', id)

    if (error) throw error
}
