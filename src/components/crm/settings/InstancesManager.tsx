import { useEffect, useState } from 'react'
import { listEmpresaInstancias, createEmpresaInstancia, updateEmpresaInstancia, deleteEmpresaInstancia } from '@/supabase/services/instances'
import type { EmpresaInstanciaDB } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Trash, PencilSimple, Eye, EyeSlash } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface InstancesManagerProps {
  empresaId: string
}

interface InstanceForm {
  plataforma: 'whatsapp' | 'instagram' | 'facebook' | ''
  client_id: string
  api_url: string
  label: string
  api_token: string
  webhook_secret: string
  verify_token: string
  active: boolean
}

export function InstancesManager({ empresaId }: InstancesManagerProps) {
  const [instances, setInstances] = useState<EmpresaInstanciaDB[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({})

  const emptyForm: InstanceForm = {
    plataforma: '',
    client_id: '',
    api_url: '',
    label: '',
    api_token: '',
    webhook_secret: '',
    verify_token: '',
    active: true
  }

  const [form, setForm] = useState<InstanceForm>(emptyForm)

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
    if (!form.api_token) {
      toast.error('El API Token es requerido')
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
        api_token: form.api_token.trim() || null as any,
        webhook_secret: form.webhook_secret.trim() || null as any,
        verify_token: form.verify_token.trim() || null as any,
        active: form.active
      } as any)
      setInstances((arr) => [created, ...arr])
      setForm(emptyForm)
      toast.success('Instancia creada correctamente')
    } catch (e: any) {
      console.error('[InstancesManager] create error', e)
      toast.error(e?.message || 'Error al crear instancia')
    } finally {
      setCreating(false)
    }
  }

  const handleEdit = (inst: EmpresaInstanciaDB) => {
    setEditingId(inst.id)
    setForm({
      plataforma: inst.plataforma as any,
      client_id: inst.client_id,
      api_url: inst.api_url || '',
      label: inst.label || '',
      api_token: (inst as any).api_token || '',
      webhook_secret: (inst as any).webhook_secret || '',
      verify_token: (inst as any).verify_token || '',
      active: inst.active
    })
  }

  const handleUpdate = async () => {
    if (!editingId) return
    try {
      const updated = await updateEmpresaInstancia(editingId, {
        client_id: form.client_id.trim(),
        api_url: form.api_url.trim() || null as any,
        label: form.label.trim() || null as any,
        api_token: form.api_token.trim() || null as any,
        webhook_secret: form.webhook_secret.trim() || null as any,
        verify_token: form.verify_token.trim() || null as any,
        active: form.active
      } as any)
      setInstances((arr) => arr.map(i => i.id === editingId ? updated : i))
      setEditingId(null)
      setForm(emptyForm)
      toast.success('Instancia actualizada')
    } catch (e: any) {
      console.error('[InstancesManager] update error', e)
      toast.error(e?.message || 'Error al actualizar')
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
    if (!confirm('¿Estás seguro de eliminar esta instancia?')) return
    try {
      await deleteEmpresaInstancia(id)
      setInstances((arr) => arr.filter(i => i.id !== id))
      toast.success('Instancia eliminada')
    } catch (e) {
      console.error('[InstancesManager] delete error', e)
      toast.error('No se pudo eliminar')
    }
  }

  const maskToken = (token: string | null | undefined) => {
    if (!token) return '-'
    if (token.length <= 8) return '••••••••'
    return token.substring(0, 4) + '••••••••' + token.substring(token.length - 4)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nueva Instancia</CardTitle>
          <CardDescription>
            Configura una nueva instancia de WhatsApp, Instagram o Facebook con sus credenciales de Super API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Plataforma *</Label>
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
            <div>
              <Label>Client ID *</Label>
              <Input value={form.client_id} onChange={(e) => setForm(s => ({ ...s, client_id: e.target.value }))} placeholder="client_id de SuperAPI" />
            </div>
            <div>
              <Label>Etiqueta</Label>
              <Input value={form.label} onChange={(e) => setForm(s => ({ ...s, label: e.target.value }))} placeholder="Ej: Ventas MX" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label>API Token * <span className="text-xs text-muted-foreground">(Bearer token de Super API)</span></Label>
              <Input
                type="password"
                value={form.api_token}
                onChange={(e) => setForm(s => ({ ...s, api_token: e.target.value }))}
                placeholder="Tu token de autenticación"
              />
            </div>
            <div>
              <Label>Webhook Secret <span className="text-xs text-muted-foreground">(Para validar webhooks entrantes)</span></Label>
              <Input
                value={form.webhook_secret}
                onChange={(e) => setForm(s => ({ ...s, webhook_secret: e.target.value }))}
                placeholder="Secret único para esta instancia"
              />
            </div>
            <div>
              <Label>Verify Token <span className="text-xs text-muted-foreground">(Para verificación estilo Facebook/Meta)</span></Label>
              <Input
                value={form.verify_token}
                onChange={(e) => setForm(s => ({ ...s, verify_token: e.target.value }))}
                placeholder="Token de verificación"
              />
            </div>
            <div>
              <Label>API URL <span className="text-xs text-muted-foreground">(Opcional, default: https://v4.iasuperapi.com)</span></Label>
              <Input value={form.api_url} onChange={(e) => setForm(s => ({ ...s, api_url: e.target.value }))} placeholder="https://..." />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm(s => ({ ...s, active: v }))} />
              <span className="text-sm">Instancia activa</span>
            </div>
            <Button onClick={handleCreate} disabled={creating}>
              <Plus className="mr-2" size={18} /> Crear Instancia
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instancias Configuradas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Cargando...</div>
          ) : instances.length === 0 ? (
            <div className="text-sm text-muted-foreground">No hay instancias configuradas</div>
          ) : (
            <div className="space-y-3">
              {instances.map(inst => (
                <div key={inst.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold capitalize">{inst.plataforma}</span>
                        {inst.label && <span className="text-xs bg-muted px-2 py-0.5 rounded">{inst.label}</span>}
                        <Switch checked={inst.active} onCheckedChange={(v) => handleToggleActive(inst.id, v)} />
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span className="font-mono">{inst.client_id}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(inst)}>
                            <PencilSimple size={18} />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Editar Instancia</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label>Client ID</Label>
                                <Input value={form.client_id} onChange={(e) => setForm(s => ({ ...s, client_id: e.target.value }))} />
                              </div>
                              <div>
                                <Label>Etiqueta</Label>
                                <Input value={form.label} onChange={(e) => setForm(s => ({ ...s, label: e.target.value }))} />
                              </div>
                            </div>
                            <div>
                              <Label>API Token</Label>
                              <Input type="password" value={form.api_token} onChange={(e) => setForm(s => ({ ...s, api_token: e.target.value }))} />
                            </div>
                            <div>
                              <Label>Webhook Secret</Label>
                              <Input value={form.webhook_secret} onChange={(e) => setForm(s => ({ ...s, webhook_secret: e.target.value }))} />
                            </div>
                            <div>
                              <Label>Verify Token</Label>
                              <Input value={form.verify_token} onChange={(e) => setForm(s => ({ ...s, verify_token: e.target.value }))} />
                            </div>
                            <div>
                              <Label>API URL</Label>
                              <Input value={form.api_url} onChange={(e) => setForm(s => ({ ...s, api_url: e.target.value }))} />
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm) }}>Cancelar</Button>
                              <Button onClick={handleUpdate}>Guardar Cambios</Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(inst.id)}>
                        <Trash size={18} />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">API Token:</span>{' '}
                      <span className="font-mono">{maskToken((inst as any).api_token)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Webhook Secret:</span>{' '}
                      <span className="font-mono">{maskToken((inst as any).webhook_secret)}</span>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-muted-foreground">API URL:</span>{' '}
                      <span className="font-mono">{inst.api_url || 'https://v4.iasuperapi.com (default)'}</span>
                    </div>
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
