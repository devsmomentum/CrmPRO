import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus } from '@phosphor-icons/react'
import { TeamMember } from '@/lib/types'
import { toast } from 'sonner'

interface AddTeamMemberDialogProps {
  onAdd: (member: TeamMember) => void
}

export function AddTeamMemberDialog({ onAdd }: AddTeamMemberDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('Sales Rep')

  const roles = [
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
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`
    }

    onAdd(newMember)
    setName('')
    setEmail('')
    setRole('Sales Rep')
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
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSubmit} className="w-full">Add Team Member</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
