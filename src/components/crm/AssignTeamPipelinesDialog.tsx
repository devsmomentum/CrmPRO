import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { PipelineType } from '@/lib/types'
// import { useKV } from '@github/spark/hooks'
import { usePersistentState } from '@/hooks/usePersistentState'
import { toast } from 'sonner'
import { FunnelSimple } from '@phosphor-icons/react'

const PIPELINE_OPTIONS: { value: PipelineType; label: string }[] = [
  { value: 'sales', label: 'Ventas' },
  { value: 'support', label: 'Soporte' },
  { value: 'administrative', label: 'Administrativo' }
]

export function AssignTeamPipelinesDialog() {
  const [open, setOpen] = useState(false)
  const [teamPipelines, setTeamPipelines] = usePersistentState<PipelineType[]>('team-pipeline-types', ['sales'])
  const [localSelection, setLocalSelection] = useState<Set<PipelineType>>(new Set(teamPipelines || []))

  const toggleSelection = (value: PipelineType) => {
    setLocalSelection(prev => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const handleSave = () => {
    const final = Array.from(localSelection)
    if (final.length === 0) {
      toast.error('Selecciona al menos un pipeline')
      return
    }
    setTeamPipelines(final)
    toast.success('Pipelines asignados al equipo')
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setLocalSelection(new Set(teamPipelines || [])) }}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <FunnelSimple size={18} className="mr-2" />
          Pipelines Equipo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Asignar Pipelines al Equipo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">Selecciona qué tipos de pipeline utiliza este equipo (puede ser más de uno).</p>
          <div className="space-y-2">
            {PIPELINE_OPTIONS.map(opt => (
              <div key={opt.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`pipeline-${opt.value}`}
                  checked={localSelection.has(opt.value)}
                  onCheckedChange={() => toggleSelection(opt.value)}
                />
                <Label htmlFor={`pipeline-${opt.value}`} className="text-sm cursor-pointer">{opt.label}</Label>
              </div>
            ))}
          </div>
          <Button onClick={handleSave} className="w-full">Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
