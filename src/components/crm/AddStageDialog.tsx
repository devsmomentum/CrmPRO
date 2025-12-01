import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from '@phosphor-icons/react'
import { Stage, PipelineType } from '@/lib/types'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'

interface AddStageDialogProps {
  pipelineType: PipelineType
  currentStagesCount: number
  onAdd: (stage: Stage) => void
  trigger?: React.ReactNode
}

export function AddStageDialog({ pipelineType, currentStagesCount, onAdd, trigger }: AddStageDialogProps) {
  const t = useTranslation('es')
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3b82f6')

  const predefinedColors = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', 
    '#10b981', '#06b6d4', '#6366f1', '#ef4444'
  ]

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error(t.messages.enterStageName)
      return
    }

    const newStage: Stage = {
      id: Date.now().toString(),
      name: name.trim(),
      order: currentStagesCount,
      color,
      pipelineType
    }

    onAdd(newStage)
    setName('')
    setColor('#3b82f6')
    setOpen(false)
    toast.success(t.messages.stageAdded)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm">
            <Plus size={16} />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.stage.addStage}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="stage-name">{t.stage.stageName} *</Label>
            <Input
              id="stage-name"
              value={name}
              onChange={(e) => {
                if (e.target.value.length <= 30) setName(e.target.value)
              }}
              placeholder="ej: Calificado, Negociación"
            />
          </div>
          <div>
            <Label>{t.stage.color}</Label>
            <div className="flex gap-2 mt-2">
              {predefinedColors.map(c => (
                <button
                  key={c}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === c ? 'border-foreground scale-110' : 'border-border'
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 p-0 border-0"
              />
            </div>
          </div>
          <Button onClick={handleSubmit} className="w-full">{t.buttons.add}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
