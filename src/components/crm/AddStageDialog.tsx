import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from '@phosphor-icons/react'
import { Stage, PipelineType } from '@/lib/types'
import { toast } from 'sonner'

interface AddStageDialogProps {
  pipelineType: PipelineType
  currentStagesCount: number
  onAdd: (stage: Stage) => void
  trigger?: React.ReactNode
}

export function AddStageDialog({ pipelineType, currentStagesCount, onAdd, trigger }: AddStageDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3b82f6')

  const predefinedColors = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', 
    '#10b981', '#06b6d4', '#6366f1', '#ef4444'
  ]

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('Please enter a stage name')
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
    toast.success('Stage added!')
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
          <DialogTitle>Add New Stage</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="stage-name">Stage Name *</Label>
            <Input
              id="stage-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Qualified, Negotiation"
            />
          </div>
          <div>
            <Label>Stage Color</Label>
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
          <Button onClick={handleSubmit} className="w-full">Add Stage</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
