import { supabase } from '../client'
import { Notification } from '@/lib/types'

export interface CreateNotificationDTO {
    userId: string // UUID to look up email or direct ID if table supports it
    title: string
    message: string
    type: 'info' | 'success' | 'warning' | 'error' | 'message'
    link?: string
}

export const createNotification = async (notification: CreateNotificationDTO) => {
    // First get email from ID if necessary, or assuming table uses email
    // The previous code in empresa.ts used usuario_email. 
    // Let's check if we can get email from userId.

    let email = ''

    // Check if userId is actually an email (legacy/hybrid) or UUID
    if (notification.userId.includes('@')) {
        email = notification.userId
    } else {
        const { data } = await supabase.from('usuarios').select('email').eq('id', notification.userId).single()
        if (data) email = data.email
    }

    if (!email) {
        console.error('Could not find email for notification', notification)
        return
    }

    const { error } = await supabase
        .from('notificaciones')
        .insert({
            usuario_email: email,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            link: notification.link,
            read: false,
            created_at: new Date()
        })

    if (error) {
        console.error('Error creating notification:', error)
        throw error
    }
}
