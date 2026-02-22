/**
 * ContactEditDialog - Dialog for creating/editing contacts
 */

import { useState, useEffect } from 'react'
import { Contact } from '@/lib/types'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Star } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface ContactEditDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    contact?: Contact
    onSave: (contact: Partial<Contact>) => Promise<void>
    title: string
}

export function ContactEditDialog({
    open,
    onOpenChange,
    contact,
    onSave,
    title
}: ContactEditDialogProps) {
    const [formData, setFormData] = useState<Partial<Contact>>({})
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        if (contact) {
            setFormData(contact)
        } else {
            setFormData({})
        }
    }, [contact, open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSaving(true)
        try {
            await onSave(formData)
            onOpenChange(false)
        } catch (error) {
            console.error('Error saving contact:', error)
        } finally {
            setIsSaving(false)
        }
    }

    const updateField = (field: keyof Contact, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Name */}
                    <div>
                        <Label htmlFor="name">Nombre Completo *</Label>
                        <Input
                            id="name"
                            value={formData.name || ''}
                            onChange={(e) => updateField('name', e.target.value)}
                            required
                            placeholder="Juan Pérez"
                        />
                    </div>

                    {/* Email & Phone */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email || ''}
                                onChange={(e) => updateField('email', e.target.value)}
                                placeholder="juan@example.com"
                            />
                        </div>
                        <div>
                            <Label htmlFor="phone">Teléfono</Label>
                            <Input
                                id="phone"
                                type="tel"
                                value={formData.phone || ''}
                                onChange={(e) => updateField('phone', e.target.value)}
                                placeholder="+1234567890"
                            />
                        </div>
                    </div>

                    {/* Company & Position */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="company">Empresa</Label>
                            <Input
                                id="company"
                                value={formData.company || ''}
                                onChange={(e) => updateField('company', e.target.value)}
                                placeholder="Tech Solutions Inc."
                            />
                        </div>
                        <div>
                            <Label htmlFor="position">Cargo</Label>
                            <Input
                                id="position"
                                value={formData.position || ''}
                                onChange={(e) => updateField('position', e.target.value)}
                                placeholder="CEO"
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <Label htmlFor="notes">Notas</Label>
                        <Textarea
                            id="notes"
                            value={formData.notes || ''}
                            onChange={(e) => updateField('notes', e.target.value)}
                            placeholder="Notas adicionales sobre este contacto..."
                            rows={3}
                        />
                    </div>

                    {/* Rating */}
                    <div>
                        <Label>Rating</Label>
                        <div className="flex gap-2 items-center mt-2">
                            {[1, 2, 3, 4, 5].map(rating => (
                                <button
                                    key={rating}
                                    type="button"
                                    onClick={() => updateField('rating', rating)}
                                    className="transition-transform hover:scale-110"
                                >
                                    <Star
                                        size={28}
                                        weight={(formData.rating || 0) >= rating ? 'fill' : 'regular'}
                                        className={
                                            (formData.rating || 0) >= rating
                                                ? 'text-amber-500'
                                                : 'text-muted-foreground/30'
                                        }
                                    />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Social Networks */}
                    <div className="space-y-2">
                        <Label>Redes Sociales</Label>
                        <Input
                            placeholder="LinkedIn URL"
                            value={formData.socialNetworks?.linkedin || ''}
                            onChange={(e) => updateField('socialNetworks', {
                                ...formData.socialNetworks,
                                linkedin: e.target.value
                            })}
                        />
                        <Input
                            placeholder="Instagram URL"
                            value={formData.socialNetworks?.instagram || ''}
                            onChange={(e) => updateField('socialNetworks', {
                                ...formData.socialNetworks,
                                instagram: e.target.value
                            })}
                        />
                        <Input
                            placeholder="Twitter URL"
                            value={formData.socialNetworks?.twitter || ''}
                            onChange={(e) => updateField('socialNetworks', {
                                ...formData.socialNetworks,
                                twitter: e.target.value
                            })}
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSaving}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSaving || !formData.name}>
                            {isSaving ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
