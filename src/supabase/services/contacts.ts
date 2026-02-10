/**
 * Contacts Service - Supabase CRUD operations for contacts/contactos
 */

import { supabase } from '../client'
import { ContactDB } from '@/lib/types'

/**
 * Get all contacts for a company
 */
export async function getContacts(companyId: string): Promise<ContactDB[]> {
    const { data, error } = await supabase
        .from('contactos')
        .select('*')
        .eq('empresa_id', companyId)
        .eq('archivado', false)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data as ContactDB[]
}

/**
 * Get a single contact by ID
 */
export async function getContactById(id: string): Promise<ContactDB> {
    const { data, error } = await supabase
        .from('contactos')
        .select('*')
        .eq('id', id)
        .single()

    if (error) throw error
    return data as ContactDB
}

/**
 * Create a new contact
 */
export async function createContact(contact: Partial<ContactDB>): Promise<ContactDB> {
    const { data, error } = await supabase
        .from('contactos')
        .insert({
            ...contact,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .select()
        .single()

    if (error) throw error
    return data as ContactDB
}

/**
 * Update an existing contact
 */
export async function updateContact(id: string, updates: Partial<ContactDB>): Promise<ContactDB> {
    const { data, error } = await supabase
        .from('contactos')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data as ContactDB
}

/**
 * Delete a contact permanently
 */
export async function deleteContact(id: string): Promise<void> {
    const { error } = await supabase
        .from('contactos')
        .delete()
        .eq('id', id)

    if (error) throw error
}

/**
 * Archive a contact (soft delete)
 */
export async function archiveContact(id: string): Promise<void> {
    const { error } = await supabase
        .from('contactos')
        .update({
            archivado: true,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)

    if (error) throw error
}

/**
 * Unarchive a contact
 */
export async function unarchiveContact(id: string): Promise<void> {
    const { error } = await supabase
        .from('contactos')
        .update({
            archivado: false,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)

    if (error) throw error
}

/**
 * Search contacts
 */
export async function searchContacts(companyId: string, query: string): Promise<ContactDB[]> {
    const { data, error } = await supabase
        .from('contactos')
        .select('*')
        .eq('empresa_id', companyId)
        .eq('archivado', false)
        .or(`nombre.ilike.%${query}%,email.ilike.%${query}%,telefono.ilike.%${query}%,empresa_nombre.ilike.%${query}%`)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data as ContactDB[]
}
