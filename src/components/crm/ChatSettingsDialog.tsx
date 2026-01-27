import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { upsertChatKeywords, getChatKeywords } from '@/supabase/services/chatSettings'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'

export function ChatSettingsDialog({ open, onClose, empresaId }: { open: boolean; onClose: () => void; empresaId: string }) {
  const { isGuestMode } = useAuth()
  const [keywords, setKeywords] = useState<string[]>([])
  const [newKeyword, setNewKeyword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && empresaId) {
      (async () => {
        try {
          const current = await getChatKeywords(empresaId)
          setKeywords(current)
        } catch { }
      })()
    }
  }, [open, empresaId])

  const addKeyword = () => {
    if (isGuestMode) {
      toast.error('No tienes permisos para realizar esta acción.')
      return
    }
    const kw = newKeyword.trim()
    if (!kw) return
    if (keywords.some(k => k.toLowerCase() === kw.toLowerCase())) { setNewKeyword(''); return }
    setKeywords(prev => [...prev, kw])
    setNewKeyword('')
  }

  const removeKeyword = (kw: string) => {
    if (isGuestMode) {
      toast.error('No tienes permisos para realizar esta acción.')
      return
    }
    setKeywords(prev => prev.filter(k => k !== kw))
  }

  const save = async () => {
    if (isGuestMode) {
      toast.error('No tienes permisos para realizar esta acción.')
      return
    }
    setSaving(true)
    try {
      await upsertChatKeywords(empresaId, keywords)
      onClose()
    } catch (e: any) {
      console.error('Error saving keywords:', e)
      toast.error(`Error al guardar: ${e.message || 'Error desconocido'}`)
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configuración del Chat</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Palabras clave que marcarán el chat como LEÍDO automáticamente si la IA responde.</p>
          <div className="flex gap-2">
            <Input
              placeholder="Nueva palabra clave"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addKeyword() }}
              disabled={isGuestMode}
            />
            <Button onClick={addKeyword} disabled={!newKeyword.trim() || isGuestMode}>Agregar</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {keywords.length === 0 && <span className="text-xs text-muted-foreground">Sin palabras definidas</span>}
            {keywords.map((kw) => (
              <Badge
                key={kw}
                variant="outline"
                className={`cursor-pointer ${isGuestMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => removeKeyword(kw)}
                title={isGuestMode ? "No tienes permisos" : "Click para eliminar"}
              >
                {kw}
              </Badge>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
            <Button onClick={save} disabled={saving || isGuestMode}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
