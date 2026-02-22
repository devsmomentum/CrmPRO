import { useState, useCallback, useEffect } from 'react'
import { Appointment } from '@/lib/types'
import {
    getAppointments,
    createAppointment,
    updateAppointment,
    deleteAppointment,
    CreateAppointmentDTO,
    UpdateAppointmentDTO
} from '@/supabase/services/appointments'
import { toast } from 'sonner'

export function useAppointments(companyId: string) {
    const [appointments, setAppointments] = useState<Appointment[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchAppointments = useCallback(async () => {
        if (!companyId) return
        setIsLoading(true)
        setError(null)
        try {
            const data = await getAppointments(companyId)
            setAppointments(data)
        } catch (err: any) {
            console.error('Error fetching appointments:', err)
            setError(err.message)
            toast.error('Error al cargar citas')
        } finally {
            setIsLoading(false)
        }
    }, [companyId])

    useEffect(() => {
        fetchAppointments()
    }, [fetchAppointments])

    const addAppointment = async (data: CreateAppointmentDTO) => {
        try {
            const newAppt = await createAppointment(data)
            setAppointments(prev => [...prev, newAppt])
            toast.success('Cita creada exitosamente')
            return newAppt
        } catch (err: any) {
            console.error('Error creating appointment:', err)
            toast.error('Error al crear la cita')
            throw err
        }
    }

    const editAppointment = async (id: string, updates: UpdateAppointmentDTO) => {
        try {
            const updatedAppt = await updateAppointment(id, updates)
            setAppointments(prev => prev.map(a => a.id === id ? updatedAppt : a))
            toast.success('Cita actualizada')
            return updatedAppt
        } catch (err: any) {
            console.error('Error updating appointment:', err)
            toast.error('Error al actualizar la cita')
            throw err
        }
    }

    const removeAppointment = async (id: string) => {
        try {
            await deleteAppointment(id)
            setAppointments(prev => prev.filter(a => a.id !== id))
            toast.success('Cita eliminada')
        } catch (err: any) {
            console.error('Error deleting appointment:', err)
            toast.error('Error al eliminar la cita')
            throw err
        }
    }

    return {
        appointments,
        isLoading,
        error,
        fetchAppointments,
        addAppointment,
        editAppointment,
        removeAppointment
    }
}
