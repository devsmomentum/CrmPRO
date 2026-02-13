import { useRef, useCallback, Dispatch, SetStateAction } from 'react'
import { Pipeline, PipelineType, Stage } from '@/lib/types'
import { updateEtapa } from '@/supabase/helpers/etapas'
import { toast } from 'sonner'

export interface UseStageDragDropOptions {
  pipelines: Pipeline[]
  activePipeline: PipelineType
  setPipelines: Dispatch<SetStateAction<Pipeline[]>>
  canEditStages: boolean
}

export interface UseStageDragDropReturn {
  draggedStageRef: React.MutableRefObject<Stage | null>
  handleStageDragStart: (e: React.DragEvent, stage: Stage) => void
  handleStageDragOverHeader: (e: React.DragEvent) => void
  handleStageDropOnHeader: (e: React.DragEvent, targetStageId: string) => Promise<void>
}

/**
 * Drag & Drop de Etapas (Stage Columns)
 * - Optimistic UI: reordena columnas inmediatamente
 * - Persistencia: actualiza `etapas.orden` en BD
 * - Rollback si falla cualquier actualización
 */
export function useStageDragDrop(options: UseStageDragDropOptions): UseStageDragDropReturn {
  const { pipelines, activePipeline, setPipelines, canEditStages } = options

  const draggedStageRef = useRef<Stage | null>(null)

  const handleStageDragStart = useCallback((e: React.DragEvent, stage: Stage) => {
    if (!canEditStages) {
      e.preventDefault()
      return
    }
    draggedStageRef.current = stage
    e.dataTransfer.effectAllowed = 'move'
    // Marcamos el tipo para distinguir de drag de leads
    e.dataTransfer.setData('application/x-stage-id', stage.id)
  }, [canEditStages])

  const handleStageDragOverHeader = useCallback((e: React.DragEvent) => {
    // Permitir drop sobre header, sin interferir con drop de leads en columna
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleStageDropOnHeader = useCallback(async (e: React.DragEvent, targetStageId: string) => {
    e.preventDefault()
    e.stopPropagation()

    if (!canEditStages) return
    const draggedStage = draggedStageRef.current
    const draggedId = e.dataTransfer.getData('application/x-stage-id') || draggedStage?.id
    if (!draggedId) return
    if (draggedId === targetStageId) return

    const pipelineIndex = (pipelines || []).findIndex(p => p.type === activePipeline)
    if (pipelineIndex === -1) return

    const prevPipelines = pipelines
    const pipeline = prevPipelines[pipelineIndex]
    const stages = [...(pipeline.stages || [])]
    const fromIndex = stages.findIndex(s => s.id === draggedId)
    const toIndex = stages.findIndex(s => s.id === targetStageId)
    if (fromIndex === -1 || toIndex === -1) return

    // Reordenar: insertar antes del target
    const [moved] = stages.splice(fromIndex, 1)
    stages.splice(toIndex, 0, moved)

    // Recalcular `order` secuencial
    const reordered = stages.map((s, idx) => ({ ...s, order: idx }))

    // 1) Optimistic UI
    setPipelines((current) => {
      const next = [...(current || [])]
      const i = next.findIndex(p => p.type === activePipeline)
      if (i === -1) return current
      next[i] = { ...next[i], stages: reordered }
      return next
    })

    // 2) Persistir en BD (solo si IDs parecen reales)
    const isUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    const updatable = reordered.filter(s => isUUID(s.id))

    try {
      await Promise.all(updatable.map(s => updateEtapa(s.id, { orden: s.order })))
      toast.success('Etapas reordenadas')
    } catch (err: any) {
      console.error('[useStageDragDrop] Error actualizando orden de etapas:', err)
      toast.error(`Error al reordenar etapas: ${err?.message || 'Error desconocido'}`)
      // 3) Rollback
      setPipelines(prevPipelines)
    } finally {
      draggedStageRef.current = null
    }
  }, [canEditStages, pipelines, activePipeline, setPipelines])

  return {
    draggedStageRef,
    handleStageDragStart,
    handleStageDragOverHeader,
    handleStageDropOnHeader,
  }
}
