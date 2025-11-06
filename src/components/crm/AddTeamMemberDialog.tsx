import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus } from '@phosphor-icons/react'
import { TeamMember, Role } from '@/lib/types'
import { useKV } from '@github/spark/hooks'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'

interface AddTeamMemberDialogProps {
  onAdd: (member: TeamMember) => void
}

export function AddTeamMemberDialog({ onAdd }: AddTeamMemberDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('Sales Rep')
  const [selectedRoleId, setSelectedRoleId] = useState<string>('')
  const [roles] = useKV<Role[]>('roles', [])

  const jobRoles = [
    'Sales Rep',
    'Sales Manager',
    'Support Agent',
    'Support Manager',
    'Account Executive',
    'Business Developer',
    'Customer Success',
    'Administrator'
  ]

  const handleSubmit = () => {
    if (!name.trim() || !email.trim()) {
      toast.error('Please fill in all required fields')
      return
    }

    const newMember: TeamMember = {
      id: Date.now().toString(),
      name: name.trim(),
      email: email.trim(),
      role,
      roleId: selectedRoleId || undefined,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`
    }

    onAdd(newMember)
    setName('')
    setEmail('')
    setRole('Sales Rep')
    setSelectedRoleId('')
    setOpen(false)
    toast.success('Team member added!')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2" size={20} />
          Add Member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Team Member</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
            />
          </div>
          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@company.com"
            />
          </div>
          <div>
            <Label htmlFor="role">Job Title</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {jobRoles.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="permission-role">Permission Role (Opcional)</Label>
            <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
              <SelectTrigger id="permission-role">
                <SelectValue placeholder="Sin rol de permisos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sin rol de permisos</SelectItem>
                {(roles || []).map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: r.color }}
                      />
                      {r.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Define los permisos de acceso para este miembro
            </p>
          </div>
          <Button onClick={handleSubmit} className="w-full">Add Team Member</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
