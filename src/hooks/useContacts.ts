/**
 * useContacts - Hook for managing contacts data
 * Fetches contacts from Supabase 'contactos' table
 */

import { useState, useEffect, useCallback } from 'react'
import { Contact, ContactDB } from '@/lib/types'
import {
    getContacts,
    createContact as createContactService,
    updateContact as updateContactService,
    deleteContact as deleteContactService,
    archiveContact as archiveContactService,
    searchContacts as searchContactsService
} from '@/supabase/services/contacts'
import { toast } from 'sonner'

/**
 * Map database contact to Contact type
 */
function mapDBToContact(db: ContactDB): Contact {
    return {
        id: db.id,
        name: db.nombre,
        email: db.email || undefined,
        phone: db.telefono || undefined,
        company: db.empresa_nombre || undefined,
        position: db.cargo || undefined,
        notes: db.notas || undefined,
        archived: db.archivado,
        createdAt: new Date(db.created_at),
        updatedAt: db.updated_at ? new Date(db.updated_at) : undefined,

        // Campos de UI que no están en la tabla contactos aún
        tags: [],
        rating: 0,
        avatar: undefined,
        location: undefined,
        source: undefined,
        birthday: undefined,
        assignedTo: undefined,
        socialNetworks: []
    }
}

/**
 * Map Contact type to database format
 */
function mapContactToDB(contact: Partial<Contact>, companyId: string): Partial<ContactDB> {
    return {
        nombre: contact.name,
        email: contact.email || null,
        telefono: contact.phone || null,
        empresa_nombre: contact.company || null,
        cargo: contact.position || null,
        notas: contact.notes || null,
        archivado: contact.archived || false,
        empresa_id: companyId
    }
}

export function useContacts(companyId?: string) {
    const [contacts, setContacts] = useState<Contact[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const fetchContacts = useCallback(async () => {
        if (!companyId) {
            setIsLoading(false)
            return
        }

        try {
            setIsLoading(true)
            setError(null)
            const data = await getContacts(companyId)
            setContacts(data.map(mapDBToContact))
        } catch (err) {
            console.error('Error fetching contacts:', err)
            setError(err as Error)
            toast.error('Error al cargar contactos')
        } finally {
            setIsLoading(false)
        }
    }, [companyId])

    useEffect(() => {
        fetchContacts()
    }, [fetchContacts])

    const createContact = useCallback(async (contact: Partial<Contact>): Promise<Contact | null> => {
        if (!companyId) return null

        try {
            const dbContact = mapContactToDB(contact, companyId)
            const created = await createContactService(dbContact)
            const newContact = mapDBToContact(created)
            setContacts(prev => [newContact, ...prev])
            toast.success('Contacto creado exitosamente')
            return newContact
        } catch (err) {
            console.error('Error creating contact:', err)
            toast.error('Error al crear contacto')
            return null
        }
    }, [companyId])

    const updateContact = useCallback(async (id: string, updates: Partial<Contact>): Promise<Contact | null> => {
        if (!companyId) return null

        try {
            const dbUpdates = mapContactToDB(updates, companyId)
            const updated = await updateContactService(id, dbUpdates)
            const updatedContact = mapDBToContact(updated)
            setContacts(prev => prev.map(c => c.id === id ? updatedContact : c))
            toast.success('Contacto actualizado exitosamente')
            return updatedContact
        } catch (err) {
            console.error('Error updating contact:', err)
            toast.error('Error al actualizar contacto')
            return null
        }
    }, [companyId])

    const deleteContact = useCallback(async (id: string): Promise<boolean> => {
        try {
            await deleteContactService(id)
            setContacts(prev => prev.filter(c => c.id !== id))
            toast.success('Contacto eliminado')
            return true
        } catch (err) {
            console.error('Error deleting contact:', err)
            toast.error('Error al eliminar contacto')
            return false
        }
    }, [])

    const archiveContact = useCallback(async (id: string): Promise<boolean> => {
        try {
            await archiveContactService(id)
            setContacts(prev => prev.filter(c => c.id !== id))
            toast.success('Contacto archivado')
            return true
        } catch (err) {
            console.error('Error archiving contact:', err)
            toast.error('Error al archivar contacto')
            return false
        }
    }, [])

    const searchContacts = useCallback(async (query: string): Promise<Contact[]> => {
        if (!companyId) return []

        try {
            const data = await searchContactsService(companyId, query)
            return data.map(mapDBToContact)
        } catch (err) {
            console.error('Error searching contacts:', err)
            toast.error('Error al buscar contactos')
            return []
        }
    }, [companyId])

    return {
        contacts,
        isLoading,
        error,
        refetch: fetchContacts,
        createContact,
        updateContact,
        deleteContact,
        archiveContact,
        searchContacts
    }
}
