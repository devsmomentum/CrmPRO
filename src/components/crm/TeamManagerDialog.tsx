import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Users, Trash, Funnel, Plus, MagnifyingGlass } from '@phosphor-icons/react'
import { toast } from 'sonner'

type Equipo = { id: string; nombre_equipo: string; empresa_id: string; created_at: string }

interface TeamManagerDialogProps {
    equipos: Equipo[]
    selectedTeamFilter: string | null
    onCreateTeam: (nombre: string) => Promise<void>
    onDeleteTeam: (id: string) => Promise<void>
    onSelectFilter: (teamId: string | null) => void
    isAdminOrOwner: boolean
}

export function TeamManagerDialog({
    equipos,
    selectedTeamFilter,
    onCreateTeam,
    onDeleteTeam,
    onSelectFilter,
    isAdminOrOwner
}: TeamManagerDialogProps) {
    const [open, setOpen] = useState(false)
    const [newTeamName, setNewTeamName] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [isCreating, setIsCreating] = useState(false)

    const filteredEquipos = equipos.filter(eq =>
        eq.nombre_equipo.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleCreateTeam = async () => {
        if (!newTeamName.trim()) {
            toast.error('El nombre del equipo es requerido')
            return
        }

        setIsCreating(true)
        try {
            await onCreateTeam(newTeamName.trim())
            setNewTeamName('')
            toast.success('Equipo creado exitosamente')
        } catch (error) {
            toast.error('Error al crear equipo')
        } finally {
            setIsCreating(false)
        }
    }

    const handleDeleteTeam = async (id: string, nombre: string) => {
        if (!confirm(`¿Eliminar el equipo "${nombre}"?`)) return

        try {
            await onDeleteTeam(id)
            toast.success('Equipo eliminado')
        } catch (error) {
            toast.error('Error al eliminar equipo')
        }
    }

    const handleSelectTeam = (teamId: string | null) => {
        onSelectFilter(teamId)
        setOpen(false)
    }

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(true)}
                className="gap-2"
                data-team-manager-trigger
            >
                <Users size={18} />
                <span className="hidden sm:inline">Equipos</span>
                {selectedTeamFilter && selectedTeamFilter !== 'no-team' && (
                    <Badge variant="secondary" className="ml-1">
                        {equipos.find(e => e.id === selectedTeamFilter)?.nombre_equipo || '?'}
                    </Badge>
                )}
                {selectedTeamFilter === 'no-team' && (
                    <Badge variant="secondary" className="ml-1">Sin Equipo</Badge>
                )}
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Gestión de Equipos</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Crear nuevo equipo */}
                        {isAdminOrOwner && (
                            <div className="p-4 border rounded-lg bg-muted/30">
                                <h3 className="font-semibold mb-3">Crear Nuevo Equipo</h3>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Nombre del equipo"
                                        value={newTeamName}
                                        onChange={(e) => {
                                            if (e.target.value.length <= 30) setNewTeamName(e.target.value)
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleCreateTeam()
                                        }}
                                    />
                                    <Button onClick={handleCreateTeam} disabled={isCreating}>
                                        <Plus size={16} className="mr-2" />
                                        Crear
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Filtros rápidos */}
                        <div className="flex gap-2 flex-wrap">
                            <Button
                                variant={selectedTeamFilter === null ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleSelectTeam(null)}
                            >
                                <Users className="mr-2" size={16} />
                                Todos
                            </Button>
                            <Button
                                variant={selectedTeamFilter === 'no-team' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleSelectTeam('no-team')}
                            >
                                Sin Equipo
                            </Button>
                        </div>

                        {/* Buscador */}
                        <div className="relative">
                            <MagnifyingGlass className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar equipos..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>

                        {/* Lista de equipos */}
                        <div className="max-h-[400px] overflow-y-auto space-y-2">
                            {filteredEquipos.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Users size={48} className="mx-auto mb-3 opacity-50" />
                                    <p>No hay equipos disponibles</p>
                                    {isAdminOrOwner && <p className="text-sm mt-1">Crea uno nuevo arriba</p>}
                                </div>
                            ) : (
                                filteredEquipos.map(eq => (
                                    <div
                                        key={eq.id}
                                        className={`flex items-center justify-between border rounded-lg p-3 transition-colors ${selectedTeamFilter === eq.id
                                            ? 'bg-muted/50 border-primary'
                                            : 'hover:bg-muted/30'
                                            }`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate">{eq.nombre_equipo}</div>
                                            <div className="text-xs text-muted-foreground">
                                                Creado: {new Date(eq.created_at).toLocaleDateString('es-ES')}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 ml-4">
                                            <Button
                                                variant={selectedTeamFilter === eq.id ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => handleSelectTeam(eq.id)}
                                            >
                                                <Funnel size={14} className="mr-1" />
                                                {selectedTeamFilter === eq.id ? 'Filtrando' : 'Filtrar'}
                                            </Button>
                                            {isAdminOrOwner && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleDeleteTeam(eq.id, eq.nombre_equipo)}
                                                >
                                                    <Trash size={14} />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {filteredEquipos.length > 0 && (
                            <div className="text-xs text-center text-muted-foreground pt-2 border-t">
                                {filteredEquipos.length} equipo(s)
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
