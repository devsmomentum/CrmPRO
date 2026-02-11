/**
 * ContactsList - Sidebar with searchable contact list
 */

import { useState, useMemo } from 'react'
import { Contact } from '@/lib/types'
import { ContactCard } from './ContactCard'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MagnifyingGlass, SortAscending, Spinner } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface ContactsListProps {
    contacts: Contact[]
    isLoading: boolean
    selectedContact: Contact | null
    onSelectContact: (contact: Contact) => void
}

type SortOption = 'name-asc' | 'name-desc' | 'recent' | 'oldest' | 'rating'

export function ContactsList({
    contacts,
    isLoading,
    selectedContact,
    onSelectContact
}: ContactsListProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState<SortOption>('recent')

    // Filter and sort contacts
    const filteredAndSortedContacts = useMemo(() => {
        let result = [...contacts]

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase()
            result = result.filter(contact =>
                contact.name.toLowerCase().includes(query) ||
                contact.email?.toLowerCase().includes(query) ||
                contact.phone?.includes(query) ||
                contact.company?.toLowerCase().includes(query)
            )
        }

        // Apply sorting
        result.sort((a, b) => {
            switch (sortBy) {
                case 'name-asc':
                    return a.name.localeCompare(b.name)
                case 'name-desc':
                    return b.name.localeCompare(a.name)
                case 'recent':
                    return b.createdAt.getTime() - a.createdAt.getTime()
                case 'oldest':
                    return a.createdAt.getTime() - b.createdAt.getTime()
                case 'rating':
                    return (b.rating || 0) - (a.rating || 0)
                default:
                    return 0
            }
        })

        return result
    }, [contacts, searchQuery, sortBy])

    return (
        <div className="w-full md:w-80 border-r border-border flex flex-col h-full bg-card overflow-hidden">
            {/* Search and Filters - Fixed Header */}
            <div className="flex-none p-4 space-y-3 border-b border-border bg-card z-10">
                {/* Search Input */}
                <div className="relative">
                    <MagnifyingGlass
                        size={18}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                        placeholder="Buscar contactos..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>

                {/* Sort Dropdown */}
                <Select value={sortBy} onValueChange={(val) => setSortBy(val as SortOption)}>
                    <SelectTrigger className="w-full">
                        <div className="flex items-center gap-2">
                            <SortAscending size={16} />
                            <SelectValue placeholder="Ordenar por..." />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="recent">Más recientes</SelectItem>
                        <SelectItem value="oldest">Más antiguos</SelectItem>
                        <SelectItem value="name-asc">Nombre (A-Z)</SelectItem>
                        <SelectItem value="name-desc">Nombre (Z-A)</SelectItem>
                        <SelectItem value="rating">Rating (mayor)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Contacts List - Scrollable Area */}
            <ScrollArea className="flex-1 h-full">
                <div className="p-2 pb-20">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Spinner size={32} className="animate-spin text-primary" />
                        </div>
                    ) : filteredAndSortedContacts.length === 0 ? (
                        <div className="text-center py-12 px-4">
                            <p className="text-muted-foreground text-sm">
                                {searchQuery ? 'No se encontraron contactos' : 'No hay contactos aún'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredAndSortedContacts.map(contact => (
                                <ContactCard
                                    key={contact.id}
                                    contact={contact}
                                    isSelected={selectedContact?.id === contact.id}
                                    onClick={() => onSelectContact(contact)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Footer with count - Fixed Footer relative to list if needed, or just scrolling with it? 
                User wants independent scroll. Sticky footer is better.
            */}
            <div className="flex-none p-3 border-t border-border bg-muted/20 z-10">
                <p className="text-xs text-muted-foreground text-center">
                    {filteredAndSortedContacts.length} {filteredAndSortedContacts.length === 1 ? 'contacto' : 'contactos'}
                </p>
            </div>
        </div>
    )
}
