// import { useKV } from '@github/spark/hooks'
import { usePersistentState } from '@/hooks/usePersistentState'
import { TeamMember, Task, Role, Lead } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { AddTeamMemberDialog } from './AddTeamMemberDialog'
import { Button } from '@/components/ui/button'
import { Trash, Building, Info } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useEffect, useState } from 'react'
import { createEquipo, deleteEquipo, getEquipos } from '@/supabase/services/equipos'
import { Input } from '@/components/ui/input'

type Equipo = { id: string; nombre_equipo: string; empresa_id: string; created_at: string }

export function TeamView({ companyId }: { companyId?: string }) {
  if (!companyId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="bg-muted/50 p-6 rounded-full mb-4">
          <Building size={64} className="text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold mb-2">No hay empresa seleccionada</h2>
        <p className="text-muted-foreground max-w-md mb-6">
          Debes crear o seleccionar una empresa para gestionar tu equipo.
        </p>
      </div>
    )
  }

  const [teamMembers, setTeamMembers] = usePersistentState<TeamMember[]>(`team-members-${companyId}`, [])
  const [leads] = usePersistentState<Lead[]>(`leads-${companyId}`, [])
  const [roles] = usePersistentState<Role[]>(`roles-${companyId}`, [])
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [newTeamName, setNewTeamName] = useState('')

  useEffect(() => {
    if (!companyId) return
    ;(async () => {
      try {
        const data = await getEquipos(companyId)
        setEquipos(data as any)
      } catch (e:any) {
        console.error('[TeamView] error cargando equipos', e)
      }
    })()
  }, [companyId])
  

  const getAssignedLeadsCount = (memberName: string) => {
    return (leads || []).filter(l => l.assignedTo === memberName).length
  }
  
  const getRoleInfo = (roleId?: string) => {
    if (!roleId) return null
    return (roles || []).find(r => r.id === roleId)
  }

  const handleAddMember = (member: TeamMember) => {
    setTeamMembers((current) => [...(current || []), member])
  }

  const handleDeleteMember = (memberId: string) => {
    setTeamMembers((current) => (current || []).filter(m => m.id !== memberId))
    toast.success('Miembro eliminado')
  }

  const handleCreateEquipo = async () => {
    if (!newTeamName.trim() || !companyId) return toast.error('Nombre requerido')
    try {
      // Usamos "name" por posible ausencia de columna "nombre" en la tabla real
      const inserted = await createEquipo({ nombre_equipo: newTeamName.trim(), empresa_id: companyId })
      setEquipos((curr) => [inserted as any, ...(curr || [])])
      setNewTeamName('')
      toast.success('Equipo creado y guardado')
    } catch (e:any) {
      console.error('[TeamView] error creando equipo', e)
      toast.error(e.message || 'No se pudo crear el equipo')
    }
  }

  const handleDeleteEquipo = async (id: string) => {
    try {
      await deleteEquipo(id)
      setEquipos((curr) => (curr || []).filter(e => e.id !== id))
      toast.success('Equipo eliminado')
    } catch (e:any) {
      console.error('[TeamView] error eliminando equipo', e)
      toast.error(e.message || 'No se pudo eliminar el equipo')
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Team</h1>
          <p className="text-muted-foreground text-sm">Manage team members and assignments</p>
          
        </div>
        <div className="flex items-center gap-2">
          <AddTeamMemberDialog onAdd={handleAddMember} />
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <h2 className="text-lg font-semibold">Equipos de la empresa</h2>
        <div className="flex gap-2">
          <Input placeholder="Nombre del equipo" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} className="max-w-xs" />
          <Button onClick={handleCreateEquipo}>Crear Equipo</Button>
        </div>
        <div className="grid gap-2">
          {(equipos || []).length === 0 && <p className="text-sm text-muted-foreground">Sin equipos aún</p>}
          {(equipos || []).map(eq => (
            <div key={eq.id} className="flex items-center justify-between border rounded-md p-2">
              <div>
                <div className="font-medium">{eq.nombre_equipo}</div>
                <div className="text-xs text-muted-foreground">Creado: {new Date(eq.created_at).toLocaleString('es-ES')}</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleDeleteEquipo(eq.id)}>
                <Trash size={14} />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(teamMembers || []).map(member => {
          const roleInfo = getRoleInfo(member.roleId)
          return (
            <Card key={member.id}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback>{member.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="text-base">{member.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-muted-foreground">{member.role}</p>
                      {roleInfo && (
                        <Badge 
                          variant="outline" 
                          className="text-xs"
                          style={{ borderColor: roleInfo.color, color: roleInfo.color }}
                        >
                          {roleInfo.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteMember(member.id)}
                    title="Eliminar miembro"
                  >
                    <Trash size={16} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium truncate ml-2">{member.email}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Active Tasks</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{getAssignedLeadsCount(member.name)}</Badge>
                      {getAssignedLeadsCount(member.name) > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-muted">
                              <Info size={14} className="text-muted-foreground" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-60" align="end">
                            <div className="space-y-2">
                              <h4 className="font-medium text-sm">Leads Asignados</h4>
                              <div className="grid gap-1">
                                {(leads || []).filter(l => l.assignedTo === member.name).map(lead => (
                                  <div key={lead.id} className="text-sm flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${
                                      lead.priority === 'high' ? 'bg-red-500' : 
                                      lead.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                                    }`} />
                                    <span className="truncate">{lead.name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Pipelines</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(member.pipelines || []).map(tp => (
                        <Badge key={tp} variant="outline" className="text-xs capitalize">
                          {tp === 'sales' && 'Ventas'}
                          {tp === 'support' && 'Soporte'}
                          {tp === 'administrative' && 'Administrativo'}
                        </Badge>
                      ))}
                      {(member.pipelines || []).length === 0 && (
                        <span className="text-xs text-muted-foreground">Sin asignar</span>
                      )}
                    </div>
                  </div>
                  {roleInfo && roleInfo.permissions.length > 0 && (
                    <div className="pt-2 border-t border-border">
                      <span className="text-xs text-muted-foreground">
                        {roleInfo.permissions.length} permisos
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}

        {(teamMembers || []).length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No team members added yet
          </div>
        )}
      </div>
    </div>
  )
}
