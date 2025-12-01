// import { useKV } from '@github/spark/hooks'
import { TeamMember, Task, Role, Lead } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { AddTeamMemberDialog } from './AddTeamMemberDialog'
import { Button } from '@/components/ui/button'
import { Trash, Building, Info, Funnel, Users, XCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useEffect, useState } from 'react'
import { createEquipo, deleteEquipo, getEquipos } from '@/supabase/services/equipos'
import { getPersonas, createPersona, deletePersona } from '@/supabase/services/persona'
import { getPipelines } from '@/supabase/helpers/pipeline'
import { addPersonaToPipeline, getPipelinesForPersona } from '@/supabase/helpers/personaPipeline'
import { getLeads } from '@/supabase/services/leads'
import { Input } from '@/components/ui/input'

type Equipo = { id: string; nombre_equipo: string; empresa_id: string; created_at: string }

import { Company } from './CompanyManagement'

export function TeamView({ companyId, companies = [], currentUserId }: { companyId?: string; companies?: Company[]; currentUserId?: string }) {
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

  const currentCompany = companies.find(c => c.id === companyId)
  const userRole = currentCompany?.role || 'viewer'
  const isOwnerById = currentUserId && currentCompany?.ownerId === currentUserId
  const isAdminOrOwner = userRole === 'admin' || userRole === 'owner' || isOwnerById

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  // leads y roles ahora se inicializan como arrays vacíos, y deben obtenerse de la BD si se requiere
  const [leads, setLeads] = useState<Lead[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [dbPipelines, setDbPipelines] = useState<any[]>([])
  const [newTeamName, setNewTeamName] = useState('')
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string | null>(null) // null = all, 'no-team' = unassigned, uuid = specific team
  const [refreshTrigger, setRefreshTrigger] = useState(0) // Disparar recarga de invitaciones

  useEffect(() => {
    if (!companyId) return
    getPipelines(companyId).then(({ data }) => {
      if (data) setDbPipelines(data)
    })
  }, [companyId])

  useEffect(() => {
    if (!companyId) return
      ; (async () => {
        try {
          const data = await getEquipos(companyId)
          setEquipos(data as any)
        } catch (e: any) {
          console.error('[TeamView] error cargando equipos', e)
        }
      })()
  }, [companyId])

  useEffect(() => {
    if (!companyId) return
    getLeads(companyId)
      .then((data: any) => {
        const mappedLeads = data.map((l: any) => ({
          id: l.id,
          name: l.nombre_completo,
          email: l.correo_electronico,
          phone: l.telefono,
          company: l.empresa,
          budget: l.presupuesto,
          stage: l.etapa_id,
          pipeline: l.pipeline_id,
          priority: l.prioridad,
          assignedTo: l.asignado_a,
          tags: [],
          createdAt: new Date(l.created_at),
          lastContact: new Date(l.created_at)
        }))
        setLeads(mappedLeads)
      })
      .catch(err => console.error('[TeamView] Error loading leads:', err))
  }, [companyId])

  useEffect(() => {
    if (!companyId) return
      ; (async () => {
        try {
          // Si hay filtro de equipo, solo ese; si no, todos de la empresa
          let personas: any[] = []
          if (selectedTeamFilter && selectedTeamFilter !== 'no-team') {
            personas = await getPersonas(selectedTeamFilter)
          } else {
            // Obtener todos los equipos y concatenar miembros
            const equiposIds = equipos.map(e => e.id)
            const allPersonas = await Promise.all(equiposIds.map(id => getPersonas(id)))
            personas = allPersonas.flat()
          }

          // Obtener invitaciones pendientes
          const { getPendingInvitationsByCompany } = await import('@/supabase/services/invitations')
          const pendingInvites = await getPendingInvitationsByCompany(companyId)
          console.log('[TeamView] pendingInvites raw:', pendingInvites)

          // Obtener roles de miembros activos
          const { getCompanyMembers } = await import('@/supabase/services/empresa')
          const companyMembers = await getCompanyMembers(companyId)

          const mappedPending = pendingInvites.map((inv: any) => {
            const resolvedPipelines = (inv.pipeline_ids || []).map((pid: string) => {
              const found = dbPipelines.find(p => p.id === pid)
              return found ? found.nombre : pid
            })

            return {
              id: inv.id,
              name: inv.invited_nombre || inv.invited_email,
              email: inv.invited_email,
              role: inv.invited_titulo_trabajo || 'Pending',
              pipelines: resolvedPipelines,
              avatar: '',
              status: 'pending',
              permissionRole: inv.permission_role || 'viewer'
            }
          })

          const mapped = await Promise.all(personas.map(async p => {
            let memberPipelines: string[] = []
            try {
              const { data: pPipelines } = await getPipelinesForPersona(p.id)
              if (pPipelines) {
                memberPipelines = pPipelines.map((pp: any) => {
                  const found = dbPipelines.find(dbp => dbp.id === pp.pipeline_id)
                  return found ? found.nombre : pp.pipeline_id
                })
              }
            } catch (err) {
              console.error('Error loading pipelines for persona', p.id, err)
            }

            // Buscar rol en empresa_miembros
            // Intentamos coincidir por usuario_id si existe, o por email
            const memberInfo = companyMembers?.find((m: any) => 
              (p.usuario_id && m.usuario_id === p.usuario_id) || 
              (m.email && p.email && m.email.toLowerCase() === p.email.toLowerCase())
            )

            return {
              id: p.id,
              name: p.nombre,
              email: p.email,
              avatar: '',
              role: p.titulo_trabajo || '',
              teamId: p.equipo_id || undefined,
              pipelines: memberPipelines,
              permissionRole: memberInfo?.role || 'viewer'
            }
          }))
          const mappedMembers = mapped.map((m: any) => ({
            ...m,
            status: 'active'
          }))

          setTeamMembers([...mappedMembers, ...mappedPending])
        } catch (e: any) {
          console.error('[TeamView] error cargando miembros', e)
        }
      })()
  }, [companyId, equipos, selectedTeamFilter, dbPipelines, refreshTrigger])


  // Si necesitas cargar leads y roles desde la BD, agrega aquí los efectos y servicios
  const getAssignedLeadsCount = (memberId: string) => {
    return leads.filter(l => l.assignedTo === memberId).length
  }

  const getRoleInfo = (roleId?: string) => {
    if (!roleId) return null
    return roles.find(r => r.id === roleId)
  }

  const handleAddMember = async (member: TeamMember) => {
    try {
      const inserted = await createPersona({
        nombre: member.name,
        email: member.email,
        titulo_trabajo: member.role,
        equipo_id: member.teamId || null,
        permisos: []
      })

      // Guardar pipelines
      if (member.pipelines && member.pipelines.length > 0) {
        for (const pipelineVal of member.pipelines) {
          // Verificamos si es un UUID válido
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pipelineVal)

          if (isUUID) {
            await addPersonaToPipeline({
              persona_id: inserted.id,
              pipeline_id: pipelineVal
            })
          } else {
            // Si no es UUID (ej: 'sales'), intentamos buscarlo en los pipelines de la BD por nombre o tipo si existiera
            // Esto es un "best effort" por si acaso existen pipelines con esos nombres
            const found = dbPipelines.find(p => p.nombre.toLowerCase() === pipelineVal.toLowerCase())
            if (found) {
              await addPersonaToPipeline({
                persona_id: inserted.id,
                pipeline_id: found.id
              })
            }
          }
        }
      }

      // Resolver nombres de pipelines para visualización local
      const resolvedPipelines = (member.pipelines || []).map(pVal => {
        // Si es uno de los defaults, lo dejamos tal cual
        if (['sales', 'support', 'administrative'].includes(pVal)) return pVal

        // Si es UUID, buscamos en dbPipelines
        const found = dbPipelines.find(p => p.id === pVal)
        if (found) return found.nombre

        // Si no encontramos, devolvemos el valor original (fallback)
        return pVal
      })

      const mapped: TeamMember = {
        id: inserted.id,
        name: inserted.nombre,
        email: inserted.email,
        avatar: '',
        role: inserted.titulo_trabajo || '',
        teamId: inserted.equipo_id || undefined,
        pipelines: resolvedPipelines // Usamos los nombres resueltos
      }
      setTeamMembers((current) => [...(current || []), mapped])
      toast.success('Miembro guardado')
    } catch (e: any) {
      console.error('[TeamView] error creando persona', e)
      toast.error(e.message || 'No se pudo crear el miembro')
    }
  }

  const handleDeleteMember = async (memberId: string) => {
    if (!isAdminOrOwner) {
      toast.error('No tienes permisos para eliminar miembros')
      return
    }
    try {
      // Detectar si es una invitación pendiente
      const member: any = (teamMembers || []).find(m => m.id === memberId)
      if (member && member.status === 'pending') {
        const { cancelInvitation } = await import('@/supabase/services/invitations')
        await cancelInvitation(memberId)
        setTeamMembers((current) => (current || []).filter(m => m.id !== memberId))
        toast.success('Invitación cancelada y eliminada del CRM del invitado')
        return
      }

      await deletePersona(memberId)
      setTeamMembers((current) => (current || []).filter(m => m.id !== memberId))
      toast.success('Miembro eliminado de la base de datos')
    } catch (e: any) {
      console.error('[TeamView] error eliminando persona', e)
      toast.error(e.message || 'No se pudo eliminar el miembro')
    }
  }

  const handleCreateEquipo = async () => {
    if (!newTeamName.trim() || !companyId) return toast.error('Nombre requerido')
    try {
      // Usamos "name" por posible ausencia de columna "nombre" en la tabla real
      const inserted = await createEquipo({ nombre_equipo: newTeamName.trim(), empresa_id: companyId })
      setEquipos((curr) => [inserted as any, ...(curr || [])])
      setNewTeamName('')
      toast.success('Equipo creado y guardado')
    } catch (e: any) {
      console.error('[TeamView] error creando equipo', e)
      toast.error(e.message || 'No se pudo crear el equipo')
    }
  }

  const handleDeleteEquipo = async (id: string) => {
    try {
      await deleteEquipo(id)
      setEquipos((curr) => (curr || []).filter(e => e.id !== id))
      toast.success('Equipo eliminado')
    } catch (e: any) {
      console.error('[TeamView] error eliminando equipo', e)
      toast.error(e.message || 'No se pudo eliminar el equipo')
    }
  }

  const filteredMembers = (teamMembers || []).filter(member => {
    if (selectedTeamFilter === null) return true
    if (selectedTeamFilter === 'no-team') return !member.teamId
    return member.teamId === selectedTeamFilter
  })

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Team</h1>
          <p className="text-muted-foreground text-sm">Manage team members and assignments</p>

        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            {isAdminOrOwner && (
              <AddTeamMemberDialog
                onAdd={handleAddMember}
                companyId={companyId}
                onInvitationCreated={() => setRefreshTrigger(prev => prev + 1)}
              />
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Equipos de la empresa</h2>
          <div className="flex gap-2">
            <Button
              variant={selectedTeamFilter === null ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setSelectedTeamFilter(null)}
            >
              <Users className="mr-2" size={16} />
              Todos
            </Button>
            <Button
              variant={selectedTeamFilter === 'no-team' ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setSelectedTeamFilter('no-team')}
            >
              Sin Equipo
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          {isAdminOrOwner && (
            <>
              <Input 
                placeholder="Nombre del equipo" 
                value={newTeamName} 
                onChange={e => {
                  if (e.target.value.length <= 30) setNewTeamName(e.target.value)
                }} 
                className="max-w-xs" 
              />
              <Button onClick={handleCreateEquipo}>Crear Equipo</Button>
            </>
          )}
        </div>
        <div className="grid gap-2">
          {(equipos || []).length === 0 && <p className="text-sm text-muted-foreground">Sin equipos aún</p>}
          {(equipos || []).map(eq => (
            <div key={eq.id} className={`flex items-center justify-between border rounded-md p-2 ${selectedTeamFilter === eq.id ? 'bg-muted/50 border-primary' : ''}`}>
              <div>
                <div className="font-medium">{eq.nombre_equipo}</div>
                <div className="text-xs text-muted-foreground">Creado: {new Date(eq.created_at).toLocaleString('es-ES')}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={selectedTeamFilter === eq.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedTeamFilter(selectedTeamFilter === eq.id ? null : eq.id)}
                  title={selectedTeamFilter === eq.id ? "Mostrar todos" : "Ver miembros de este equipo"}
                >
                  <Funnel size={14} className="mr-1" />
                  {selectedTeamFilter === eq.id ? "Filtrando" : "Filtrar"}
                </Button>
                {isAdminOrOwner && (
                  <Button variant="outline" size="sm" onClick={() => handleDeleteEquipo(eq.id)}>
                    <Trash size={14} />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMembers.map(member => {
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
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{member.name}</CardTitle>
                      {(member as any).status === 'pending' && (
                        <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                          Pendiente
                        </Badge>
                      )}
                      {member.permissionRole && (
                        <Badge variant="secondary" className="text-xs">
                          {member.permissionRole === 'admin' ? 'Admin' : 'Viewer'}
                        </Badge>
                      )}
                    </div>
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
                  {isAdminOrOwner && (
                    (member as any).status === 'pending' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteMember(member.id)}
                        title="Cancelar invitación"
                      >
                        <XCircle size={16} />
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteMember(member.id)}
                        title="Eliminar miembro"
                      >
                        <Trash size={16} />
                      </Button>
                    )
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium truncate ml-2">{member.email}</span>
                  </div>
                  {member.teamId && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Equipo</span>
                      <span className="font-medium truncate ml-2">
                        {equipos.find(e => e.id === member.teamId)?.nombre_equipo || 'Desconocido'}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Active Tasks</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{getAssignedLeadsCount(member.id)}</Badge>
                      {getAssignedLeadsCount(member.id) > 0 && (
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
                                {(leads || []).filter(l => l.assignedTo === member.id).map(lead => (
                                  <div key={lead.id} className="text-sm flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${lead.priority === 'high' ? 'bg-red-500' :
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
                      {(member.pipelines || []).map(tp => {
                        let label = tp
                        if (tp === 'sales') label = 'Ventas'
                        else if (tp === 'support') label = 'Soporte'
                        else if (tp === 'administrative') label = 'Administrativo'

                        return (
                          <Badge key={tp} variant="outline" className="text-xs capitalize">
                            {label}
                          </Badge>
                        )
                      })}
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

        {filteredMembers.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            {selectedTeamFilter
              ? "No hay miembros en este equipo"
              : "No team members added yet"}
          </div>
        )}
      </div>
    </div>
  )
}
