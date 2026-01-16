import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { upsertChatKeywords, getChatKeywords } from '@/supabase/services/chatSettings'

export function ChatSettingsDialog({ open, onClose, empresaId }: { open: boolean; onClose: () => void; empresaId: string }) {
  const [keywords, setKeywords] = useState<string[]>([])
  const [newKeyword, setNewKeyword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && empresaId) {
      (async () => {
        try {
          const current = await getChatKeywords(empresaId)
          setKeywords(current)
        } catch {}
      })()
    }
  }, [open, empresaId])

  const addKeyword = () => {
    const kw = newKeyword.trim()
    if (!kw) return
    if (keywords.some(k => k.toLowerCase() === kw.toLowerCase())) { setNewKeyword(''); return }
    setKeywords(prev => [...prev, kw])
    setNewKeyword('')
  }

  const removeKeyword = (kw: string) => {
    setKeywords(prev => prev.filter(k => k !== kw))
  }

  const save = async () => {
    setSaving(true)
    try {
      await upsertChatKeywords(empresaId, keywords)
      onClose()
    } catch {}
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configuración del Chat</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Palabras clave que mantendrán el chat como no leído si aparecen en el mensaje del cliente.</p>
          <div className="flex gap-2">
            <Input placeholder="Nueva palabra clave" value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addKeyword() }} />
            <Button onClick={addKeyword} disabled={!newKeyword.trim()}>Agregar</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {keywords.length === 0 && <span className="text-xs text-muted-foreground">Sin palabras definidas</span>}
            {keywords.map((kw) => (
              <Badge key={kw} variant="outline" className="cursor-pointer" onClick={() => removeKeyword(kw)} title="Click para eliminar">
                {kw}
              </Badge>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
