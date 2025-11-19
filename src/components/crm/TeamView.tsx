// import { useKV } from '@github/spark/hooks'
import { usePersistentState } from '@/hooks/usePersistentState'
import { TeamMember, Task, Role } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { AddTeamMemberDialog } from './AddTeamMemberDialog'
import { Button } from '@/components/ui/button'
import { Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'

export function TeamView() {
  const [teamMembers, setTeamMembers] = usePersistentState<TeamMember[]>('team-members', [])
  const [tasks] = usePersistentState<Task[]>('tasks', [])
  const [roles] = usePersistentState<Role[]>('roles', [])
  

  const getTaskCount = (memberName: string) => {
    return (tasks || []).filter(t => t.assignedTo === memberName && !t.completed).length
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Team</h1>
          <p className="text-muted-foreground text-sm">Manage team members and assignments</p>
          
        </div>
        <div className="flex items-center gap-2">
          <AddTeamMemberDialog onAdd={handleAddMember} />
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
                    <Badge variant="secondary">{getTaskCount(member.name)}</Badge>
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
