/**
 * ContactHistoryTab - Tab showing timeline of interactions
 */

import { Card } from '@/components/ui/card'
import { Clock } from '@phosphor-icons/react'

interface ContactHistoryTabProps {
    contactId: string
}

export function ContactHistoryTab({ contactId }: ContactHistoryTabProps) {
    // TODO: Implement actual history fetching
    // This will show messages, meetings, notes, etc.

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 pb-32 space-y-6 text-center animate-in fade-in duration-500">
            <div className="bg-muted/20 p-6 rounded-full ring-1 ring-border shadow-sm">
                <Clock size={48} className="text-muted-foreground/60" weight="duotone" />
            </div>

            <div className="max-w-md space-y-2">
                <h3 className="text-lg font-semibold text-foreground">
                    Historial de Interacciones
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Aquí se mostrará la cronología completa de tus interacciones con este contacto: mensajes, llamadas, notas y cambios de estado.
                </p>
            </div>

            <div className="pt-4">
                <div className="inline-flex items-center rounded-full border border-transparent bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors">
                    Próximamente
                </div>
            </div>
        </div>
    )
}
