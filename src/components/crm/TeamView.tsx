import { useKV } from '@github/spark/hooks'
import { TeamMember, Task } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Plus } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'

export function TeamView() {
  const [teamMembers] = useKV<TeamMember[]>('team-members', [])
  const [tasks] = useKV<Task[]>('tasks', [])

  const getTaskCount = (memberName: string) => {
    return (tasks || []).filter(t => t.assignedTo === memberName && !t.completed).length
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team</h1>
          <p className="text-muted-foreground mt-1">Manage team members and assignments</p>
        </div>
        <Button>
          <Plus className="mr-2" size={20} />
          Add Member
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(teamMembers || []).map(member => (
          <Card key={member.id}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={member.avatar} />
                  <AvatarFallback>{member.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-base">{member.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{member.role}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{member.email}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Active Tasks</span>
                  <Badge variant="secondary">{getTaskCount(member.name)}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {(teamMembers || []).length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No team members added yet
          </div>
        )}
      </div>
    </div>
  )
}
