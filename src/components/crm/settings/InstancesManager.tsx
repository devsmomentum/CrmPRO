import { useEffect, useState } from 'react'
import { listEmpresaInstancias, createEmpresaInstancia, updateEmpresaInstancia, deleteEmpresaInstancia } from '@/supabase/services/instances'
import type { EmpresaInstanciaDB } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { supabase } from '@/supabase/client'

interface InstancesManagerProps {
  empresaId: string
}

export function InstancesManager({ empresaId }: InstancesManagerProps) {
  const [instances, setInstances] = useState<EmpresaInstanciaDB[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)


  const [form, setForm] = useState<{ plataforma: 'whatsapp' | 'instagram' | 'facebook' | ''; client_id: string; api_url: string; label: string; active: boolean }>({
    plataforma: '',
    client_id: '',
    api_url: '',
    label: '',
    active: true
  })

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        setLoading(true)
        const data = await listEmpresaInstancias(empresaId)
        if (mounted) setInstances(data)
      } catch (e) {
        console.error('[InstancesManager] list error', e)
        toast.error('No se pudieron cargar las instancias')
      } finally {
        setLoading(false)
      }
    }
    if (empresaId) load()
    return () => { mounted = false }
  }, [empresaId])

  const handleCreate = async () => {
    if (!form.plataforma || !form.client_id) {
      toast.error('Selecciona plataforma y client_id')
      return
    }
    try {
      setCreating(true)
      const created = await createEmpresaInstancia({
        empresa_id: empresaId,
        plataforma: form.plataforma,
        client_id: form.client_id.trim(),
        api_url: form.api_url.trim() || null as any,
        label: form.label.trim() || null as any,
        active: form.active
      } as any)
      setInstances((arr) => [created, ...arr])
      setForm({ plataforma: '', client_id: '', api_url: '', label: '', active: true })
      toast.success('Instancia creada')
    } catch (e: any) {
      console.error('[InstancesManager] create error', e)
      toast.error(e?.message || 'Error al crear instancia')
    } finally {
      setCreating(false)
    }
  }

  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      const updated = await updateEmpresaInstancia(id, { active })
      setInstances((arr) => arr.map(i => i.id === id ? updated : i))
    } catch (e) {
      console.error('[InstancesManager] update error', e)
      toast.error('No se pudo actualizar la instancia')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteEmpresaInstancia(id)
      setInstances((arr) => arr.filter(i => i.id !== id))
      toast.success('Instancia eliminada')
    } catch (e) {
      console.error('[InstancesManager] delete error', e)
      toast.error('No se pudo eliminar')
    }
  }



  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nueva instancia</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-1">
            <Label>Plataforma</Label>
            <Select value={form.plataforma} onValueChange={(v: any) => setForm(s => ({ ...s, plataforma: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Client ID</Label>
            <Input value={form.client_id} onChange={(e) => setForm(s => ({ ...s, client_id: e.target.value }))} placeholder="client_id de la SuperAPI" />
          </div>
          <div className="md:col-span-2">
            <Label>API URL</Label>
            <Input value={form.api_url} onChange={(e) => setForm(s => ({ ...s, api_url: e.target.value }))} placeholder="https://... (opcional)" />
          </div>
          <div className="md:col-span-1">
            <Label>Etiqueta</Label>
            <Input value={form.label} onChange={(e) => setForm(s => ({ ...s, label: e.target.value }))} placeholder="Ej. Ventas MX" />
          </div>
          <div className="md:col-span-1 flex items-end gap-2">
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm(s => ({ ...s, active: v }))} />
              <span className="text-sm">Activa</span>
            </div>
          </div>
          <div className="md:col-span-1 flex items-end">
            <Button onClick={handleCreate} disabled={creating}>
              <Plus className="mr-2" size={18} /> Agregar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instancias existentes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Cargando...</div>
          ) : (
            <div className="space-y-2">
              {instances.length === 0 && (
                <div className="text-sm text-muted-foreground">No hay instancias</div>
              )}
              {instances.map(inst => (
                <div key={inst.id} className="grid grid-cols-1 md:grid-cols-9 gap-2 items-center border rounded p-2">
                  <div className="text-sm font-medium">{inst.plataforma}</div>
                  <div className="md:col-span-2 truncate text-sm" title={inst.client_id}>{inst.client_id}</div>
                  <div className="md:col-span-2 truncate text-sm" title={inst.api_url || ''}>{inst.api_url || '-'}</div>
                  <div className="text-sm">{inst.label || '-'}</div>
                  <div className="flex items-center gap-2">
                    <Switch checked={inst.active} onCheckedChange={(v) => handleToggleActive(inst.id, v)} />
                    <span className="text-xs">{inst.active ? 'Activa' : 'Inactiva'}</span>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" className="text-destructive" onClick={() => handleDelete(inst.id)}>
                      <Trash size={18} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default InstancesManager
