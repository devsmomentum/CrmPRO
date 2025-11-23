import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pipeline, PipelineType, Stage } from '@/lib/types'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, X } from '@phosphor-icons/react'
import { createPipelineWithStages } from '@/supabase/helpers/pipeline'

interface AddPipelineDialogProps {
  open: boolean
  onClose: () => void
  onAdd: (pipeline: Pipeline) => void
  empresaId: string | undefined
}

export function AddPipelineDialog({ open, onClose, onAdd, empresaId }: AddPipelineDialogProps) {
  const t = useTranslation('es')
  
  const [name, setName] = useState('')
  const [stages, setStages] = useState<Stage[]>([
    { id: 'stage-1', name: 'Inicial', order: 0, color: '#3b82f6', pipelineType: 'sales' }
  ])
  const [stageName, setStageName] = useState('')
  const [stageColor, setStageColor] = useState('#3b82f6')

  const handleAddStage = () => {
    if (!stageName.trim()) {
      toast.error('Ingresa un nombre para la etapa')
      return
    }

    const newStage: Stage = {
      id: `stage-${Date.now()}`,
      name: stageName.trim(),
      order: stages.length,
      color: stageColor,
      pipelineType: name.toLowerCase().replace(/\s+/g, '-') // Temporary type, will be updated on submit
    }

    setStages([...stages, newStage])
    setStageName('')
    setStageColor('#3b82f6')
  }

  const handleRemoveStage = (stageId: string) => {
    const filtered = stages.filter(s => s.id !== stageId)
    setStages(filtered.map((s, idx) => ({ ...s, order: idx })))
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Ingresa un nombre para el pipeline')
      return
    }

    if (stages.length === 0) {
      toast.error('Agrega al menos una etapa')
      return
    }
    
    if (!empresaId) {
      toast.error('No se ha podido identificar la empresa.')
      return
    }

    try {
      const pipelineData = {
        name: name.trim(),
        stages: stages,
        empresa_id: empresaId
      }

      const newPipeline = await createPipelineWithStages(pipelineData)

      // Si la creación en BD fue exitosa, actualizamos el estado local
      // Usamos los stages devueltos por la BD que ya tienen UUIDs reales
      const pipelineForState = {
        ...newPipeline,
        stages: newPipeline.stages && newPipeline.stages.length > 0 ? newPipeline.stages : stages,
        type: newPipeline.type || pipelineData.name.toLowerCase().trim().replace(/\s+/g, '-')
      }

      onAdd(pipelineForState)
      resetForm()
      onClose()
      toast.success('Pipeline y etapas guardados en la base de datos')
    } catch (error: any) {
      console.error(error)
      toast.error(`Error al guardar en BD: ${error.message || 'Error desconocido'}`)
    }
  }

  const resetForm = () => {
    setName('')
    setStages([
      { id: 'stage-1', name: 'Inicial', order: 0, color: '#3b82f6', pipelineType: 'sales' }
    ])
    setStageName('')
    setStageColor('#3b82f6')
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Pipeline</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div>
            <Label htmlFor="pipeline-name">Nombre del Pipeline</Label>
            <Input
              id="pipeline-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Ventas B2B"
            />
          </div>

          <div>
            <Label>Etapas del Pipeline</Label>
            <div className="mt-2 space-y-2">
              {stages.map((stage, idx) => (
                <div key={stage.id} className="flex items-center gap-2 p-2 border border-border rounded">
                  <Badge style={{ backgroundColor: stage.color, color: 'white' }}>
                    {idx + 1}
                  </Badge>
                  <span className="flex-1">{stage.name}</span>
                  {stages.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveStage(stage.id)}
                    >
                      <X size={16} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Agregar Nueva Etapa</Label>
            <div className="flex gap-2">
              <Input
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                placeholder="Nombre de la etapa"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddStage())}
              />
              <Input
                type="color"
                value={stageColor}
                onChange={(e) => setStageColor(e.target.value)}
                className="w-20"
              />
              <Button onClick={handleAddStage} type="button">
                <Plus size={16} />
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSubmit} className="flex-1">Crear Pipeline</Button>
            <Button onClick={onClose} variant="outline">Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
