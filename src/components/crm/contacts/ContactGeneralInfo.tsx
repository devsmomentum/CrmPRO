/**
 * ContactGeneralInfo - Tab showing detailed contact information
 */

import { Contact } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    Cake,
    Tag,
    Article,
    Star,
    LinkedinLogo,
    InstagramLogo,
    TwitterLogo
} from '@phosphor-icons/react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface ContactGeneralInfoProps {
    contact: Contact
}

export function ContactGeneralInfo({ contact }: ContactGeneralInfoProps) {
    return (
        <div className="space-y-4 w-full pb-32">
            {/* Basic Info */}
            <Card className="p-4">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Article size={18} className="text-primary" />
                    Información Básica
                </h3>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <dt className="text-xs text-muted-foreground mb-1">Nombre Completo</dt>
                        <dd className="text-sm font-medium">{contact.name}</dd>
                    </div>
                    {contact.email && (
                        <div>
                            <dt className="text-xs text-muted-foreground mb-1">Email</dt>
                            <dd className="text-sm font-medium">{contact.email}</dd>
                        </div>
                    )}
                    {contact.phone && (
                        <div>
                            <dt className="text-xs text-muted-foreground mb-1">Teléfono</dt>
                            <dd className="text-sm font-medium">{contact.phone}</dd>
                        </div>
                    )}
                    {contact.company && (
                        <div>
                            <dt className="text-xs text-muted-foreground mb-1">Empresa</dt>
                            <dd className="text-sm font-medium">{contact.company}</dd>
                        </div>
                    )}
                    {contact.position && contact.position.trim().length > 0 && (
                        <div>
                            <dt className="text-xs text-muted-foreground mb-1">Cargo</dt>
                            <dd className="text-sm font-medium">{contact.position}</dd>
                        </div>
                    )}
                    {contact.location && (
                        <div>
                            <dt className="text-xs text-muted-foreground mb-1">Ubicación</dt>
                            <dd className="text-sm font-medium">{contact.location}</dd>
                        </div>
                    )}
                    {contact.birthday && (
                        <div>
                            <dt className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                <Cake size={14} />
                                Cumpleaños
                            </dt>
                            <dd className="text-sm font-medium">
                                {format(contact.birthday, 'dd/MM/yyyy', { locale: es })}
                            </dd>
                        </div>
                    )}
                    {contact.source && (
                        <div>
                            <dt className="text-xs text-muted-foreground mb-1">Fuente</dt>
                            <dd className="text-sm font-medium">{contact.source}</dd>
                        </div>
                    )}
                </dl>
            </Card>

            {/* Rating & Stats */}
            {contact.rating && (
                <Card className="p-4">
                    <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Star size={18} className="text-amber-500" weight="fill" />
                        Clasificación
                    </h3>
                    <div className="flex items-center gap-4">
                        <div className="flex gap-1">
                            {Array.from({ length: 5 }, (_, i) => (
                                <Star
                                    key={i}
                                    size={24}
                                    weight={i < contact.rating! ? 'fill' : 'regular'}
                                    className={i < contact.rating! ? 'text-amber-500' : 'text-muted-foreground/30'}
                                />
                            ))}
                        </div>
                        <Badge variant="secondary" className="font-bold">
                            {contact.rating}/5
                        </Badge>
                    </div>
                </Card>
            )}

            {/* Notes */}
            {contact.notes && (
                <Card className="p-4">
                    <h3 className="font-semibold text-foreground mb-3">Notas</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {contact.notes}
                    </p>
                </Card>
            )}

            {/* Social Networks */}
            {contact.socialNetworks && Object.keys(contact.socialNetworks).length > 0 && (
                <Card className="p-4">
                    <h3 className="font-semibold text-foreground mb-3">Redes Sociales</h3>
                    <div className="space-y-2">
                        {contact.socialNetworks.linkedin && (
                            <a
                                href={contact.socialNetworks.linkedin}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-primary hover:underline"
                            >
                                <LinkedinLogo size={18} weight="fill" className="text-blue-600" />
                                LinkedIn
                            </a>
                        )}
                        {contact.socialNetworks.instagram && (
                            <a
                                href={contact.socialNetworks.instagram}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-primary hover:underline"
                            >
                                <InstagramLogo size={18} weight="fill" className="text-pink-600" />
                                Instagram
                            </a>
                        )}
                        {contact.socialNetworks.twitter && (
                            <a
                                href={contact.socialNetworks.twitter}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-primary hover:underline"
                            >
                                <TwitterLogo size={18} weight="fill" className="text-blue-400" />
                                Twitter
                            </a>
                        )}
                    </div>
                </Card>
            )}

            {/* Tags */}
            {contact.tags && contact.tags.length > 0 && (
                <Card className="p-4">
                    <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Tag size={18} className="text-primary" />
                        Etiquetas
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {contact.tags.map(tag => (
                            <Badge key={tag} variant="secondary">
                                {tag}
                            </Badge>
                        ))}
                    </div>
                </Card>
            )}

            {/* Metadata */}
            <Card className="p-4">
                <h3 className="font-semibold text-foreground mb-3">Metadatos</h3>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                        <dt className="text-xs text-muted-foreground mb-1">Creado</dt>
                        <dd className="font-medium">
                            {format(contact.createdAt, "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
                        </dd>
                    </div>
                    {contact.updatedAt && (
                        <div>
                            <dt className="text-xs text-muted-foreground mb-1">Última actualización</dt>
                            <dd className="font-medium">
                                {format(contact.updatedAt, "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
                            </dd>
                        </div>
                    )}
                </dl>
            </Card>
        </div>
    )
}
