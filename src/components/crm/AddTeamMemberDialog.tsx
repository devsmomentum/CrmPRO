import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, CaretUpDown, Check } from '@phosphor-icons/react'
import { TeamMember, Role, PipelineType, Pipeline } from '@/lib/types'
// import { useKV } from '@github/spark/hooks'
import { usePersistentState } from '@/hooks/usePersistentState'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { getEquipos } from '@/supabase/services/equipos'
import { getPipelines } from '@/supabase/helpers/pipeline'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'

interface AddTeamMemberDialogProps {
  onAdd: (member: TeamMember) => void
  companyId?: string
  onInvitationCreated?: () => void // Callback para recargar invitaciones
}

export function AddTeamMemberDialog({ onAdd, companyId, onInvitationCreated }: AddTeamMemberDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('Sales Rep')
  const [selectedRoleId, setSelectedRoleId] = useState<string>('none')
  const [selectedTeamId, setSelectedTeamId] = useState<string>('none')
  const [teams, setTeams] = useState<{ id: string; nombre_equipo: string }[]>([])
  const [roles] = usePersistentState<Role[]>('roles', [])
  const [dbPipelines, setDbPipelines] = useState<Pipeline[]>([])
  const [memberPipelines, setMemberPipelines] = useState<Set<PipelineType>>(new Set())

  const pipelineOptions = dbPipelines.map(p => ({ value: p.id, label: p.name }))

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

  useEffect(() => {
    if (open && companyId) {
      getEquipos(companyId)
        .then((data: any) => setTeams(data || []))
        .catch(err => console.error('Error fetching teams:', err))

      getPipelines(companyId)
        .then(({ data }) => {
          if (data) {
            const mappedPipelines: Pipeline[] = data.map((p: any) => ({
              id: p.id,
              name: p.nombre,
              type: p.nombre.toLowerCase().trim().replace(/\s+/g, '-'),
              stages: [] // No necesitamos las etapas aquí
            }))
            setDbPipelines(mappedPipelines)
          }
        })
        .catch(err => console.error('Error fetching pipelines:', err))
    }
  }, [open, companyId])

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error('Please fill in all required fields')
      return
    }

    // Validar que se seleccione un equipo (es obligatorio en el schema)
    if (!selectedTeamId || selectedTeamId === 'none') {
      toast.error('Debes seleccionar un equipo para enviar la invitación')
      return
    }

    const selectedPipelines = Array.from(memberPipelines)
    if (selectedPipelines.length === 0) {
      toast.error('Selecciona al menos un pipeline')
      return
    }

    try {
      const { createInvitation } = await import('@/supabase/services/invitations')

      await createInvitation({
        equipo_id: selectedTeamId,
        empresa_id: companyId,
        invited_email: email.trim(),
        invited_nombre: name.trim(),
        invited_titulo_trabajo: role,
        pipeline_ids: selectedPipelines
      })

      onAdd({
        id: 'temp-' + Date.now(),
        name: name.trim(),
        email: email.trim(),
        role,
        pipelines: selectedPipelines,
        avatar: '',
        // @ts-ignore
        status: 'pending'
      })

      setName('')
      setEmail('')
      setRole('Sales Rep')
      setSelectedRoleId('none')
      setSelectedTeamId('none')
      setMemberPipelines(new Set())
      setOpen(false)
      toast.success('Invitación enviada', {
        description: 'El usuario recibirá una notificación en su CRM.'
      })

      // Llamar callback para recargar invitaciones
      if (onInvitationCreated) {
        onInvitationCreated()
      }
    } catch (e: any) {
      console.error('[AddTeamMemberDialog] error invitando', e)
      toast.error(e.message || 'Error al enviar invitación')
    }
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
          <p className="text-sm text-muted-foreground">
            Invita a un usuario existente a tu equipo. Debe tener una cuenta registrada con este email.
          </p>
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
                <SelectItem value="none">Sin rol de permisos</SelectItem>
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
          <div>
            <Label htmlFor="team">Equipo *</Label>
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger id="team">
                <SelectValue placeholder="Selecciona un equipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" disabled>Selecciona un equipo</SelectItem>
                {teams.map(team => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.nombre_equipo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              El equipo es obligatorio para enviar la invitación
            </p>
          </div>
          <div className="pt-2 border-t border-border">
            <Label className="mb-2 block">Pipelines del Miembro</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn(
                    "w-full justify-between font-normal",
                    memberPipelines.size === 0 && "text-muted-foreground"
                  )}
                >
                  {memberPipelines.size > 0
                    ? `${memberPipelines.size} pipeline${memberPipelines.size > 1 ? 's' : ''} seleccionado${memberPipelines.size > 1 ? 's' : ''}`
                    : "Seleccionar pipelines"}
                  <CaretUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar pipeline..." />
                  <CommandList>
                    <CommandEmpty>No se encontraron pipelines.</CommandEmpty>
                    <CommandGroup>
                      {pipelineOptions.map((pipeline) => (
                        <CommandItem
                          key={pipeline.value}
                          value={pipeline.label}
                          onSelect={() => {
                            setMemberPipelines(prev => {
                              const next = new Set(prev)
                              if (next.has(pipeline.value)) next.delete(pipeline.value)
                              else next.add(pipeline.value)
                              return next
                            })
                          }}
                        >
                          <div className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            memberPipelines.has(pipeline.value)
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible"
                          )}>
                            <Check className={cn("h-4 w-4")} />
                          </div>
                          {pipeline.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground mt-1">Selecciona los pipelines que este miembro utilizará (puede ser más de uno).</p>
          </div>
          <Button onClick={handleSubmit} className="w-full">Add Team Member</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
