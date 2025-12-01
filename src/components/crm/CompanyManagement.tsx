import { useState, useRef, Dispatch, SetStateAction } from 'react'
// import { useKV } from '@github/spark/hooks'
import { usePersistentState } from '@/hooks/usePersistentState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Plus, Upload, Trash, Building, Check } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { createEmpresa, deleteEmpresa } from '@/supabase/services/empresa'

export interface Company {
  id: string
  name: string
  logo?: string
  ownerId: string
  createdAt: Date
  role?: string // 'owner' | 'admin' | 'viewer'
}

interface CompanyManagementProps {
  currentUserId: string
  currentCompanyId: string
  onCompanyChange: (companyId: string) => void
  companies: Company[]
  setCompanies: Dispatch<SetStateAction<Company[]>>
}

export function CompanyManagement({ currentUserId, currentCompanyId, onCompanyChange, companies, setCompanies }: CompanyManagementProps) {
  // const [companies, setCompanies] = usePersistentState<Company[]>('companies', [])
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newCompanyName, setNewCompanyName] = useState('')
  const [newCompanyLogo, setNewCompanyLogo] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [editingLogoCompanyId, setEditingLogoCompanyId] = useState<string | null>(null)

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim()) {
      toast.error('El nombre de la empresa es requerido')
      return
    }
    try {
      const inserted = await createEmpresa({ nombre_empresa: newCompanyName.trim(), usuario_id: currentUserId })
      const newCompany: Company = {
        id: inserted.id,
        name: inserted.nombre_empresa,
        logo: newCompanyLogo || undefined,
        ownerId: inserted.usuario_id,
        createdAt: new Date(inserted.created_at),
        role: 'owner'
      }
      setCompanies((current) => [...(current || []), newCompany])
      onCompanyChange(newCompany.id)
      setNewCompanyName('')
      setNewCompanyLogo('')
      setShowCreateDialog(false)
      toast.success('¡Empresa creada y guardada en la base de datos!')
    } catch (e:any) {
      console.error('[CompanyManagement] Error creando empresa', e)
      toast.error(e.message || 'No se pudo crear la empresa')
    }
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, companyId?: string) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      toast.error('El archivo es muy grande. Máximo 2MB')
      return
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes')
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      if (companyId) {
        setCompanies((current) =>
          (current || []).map(c =>
            c.id === companyId ? { ...c, logo: result } : c
          )
        )
        setEditingLogoCompanyId(null)
        toast.success('Logo actualizado')
      } else {
        setNewCompanyLogo(result)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleDeleteCompany = async (companyId: string) => {
    try {
      await deleteEmpresa(companyId)
      setCompanies((current) => (current || []).filter(c => c.id !== companyId))
      if (currentCompanyId === companyId) {
        const remaining = (companies || []).filter(c => c.id !== companyId)
        if (remaining.length > 0) {
          onCompanyChange(remaining[0].id)
        } else {
          onCompanyChange('')
        }
      }
      toast.success('Empresa eliminada de la base de datos')
    } catch (e:any) {
      console.error('[CompanyManagement] Error eliminando empresa', e)
      toast.error(e.message || 'No se pudo eliminar la empresa')
    }
  }

  const userCompanies = (companies || []).filter(c => c.ownerId === currentUserId)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Gestión de Empresas</h2>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2" size={20} />
              Nueva Empresa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Crear Nueva Empresa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="company-name">Nombre de la Empresa *</Label>
                <Input
                  id="company-name"
                  value={newCompanyName}
                  onChange={(e) => {
                    if (e.target.value.length <= 30) setNewCompanyName(e.target.value)
                  }}
                  placeholder="Mi Empresa S.A."
                />
              </div>

              <div>
                <Label>Logo de la Empresa</Label>
                <div className="flex items-center gap-4 mt-2">
                  <Avatar className="h-16 w-16">
                    {newCompanyLogo ? (
                      <AvatarImage src={newCompanyLogo} alt="Logo" />
                    ) : (
                      <AvatarFallback>
                        <Building size={32} />
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleLogoUpload(e)}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="mr-2" size={16} />
                      Subir Logo
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      PNG, JPG hasta 2MB
                    </p>
                  </div>
                </div>
              </div>

              <Button onClick={handleCreateCompany} className="w-full">
                <Plus className="mr-2" size={20} />
                Crear Empresa
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {userCompanies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/10 border-dashed">
            <div className="bg-background p-4 rounded-full mb-4 shadow-sm">
              <Building size={40} className="text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No tienes empresas aún</h3>
            <p className="text-muted-foreground max-w-sm mb-6">
              Comienza creando tu primera empresa para gestionar tus proyectos y equipo.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2" size={18} />
              Crear mi primera empresa
            </Button>
          </div>
        ) : (
          userCompanies.map((company) => (
            <Card key={company.id} className={company.id === currentCompanyId ? 'ring-2 ring-primary' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="h-16 w-16">
                      {company.logo ? (
                        <AvatarImage src={company.logo} alt={company.name} />
                      ) : (
                        <AvatarFallback>
                          <Building size={32} />
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleLogoUpload(e, company.id)}
                      className="hidden"
                      id={`logo-upload-${company.id}`}
                    />
                    {(company.role === 'owner' || company.role === 'admin') && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full p-0"
                        onClick={() => document.getElementById(`logo-upload-${company.id}`)?.click()}
                      >
                        <Upload size={14} />
                      </Button>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{company.name}</h3>
                      {company.id === currentCompanyId && (
                        <Badge variant="default" className="h-5">
                          <Check size={12} className="mr-1" />
                          Activa
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Creada el {new Date(company.createdAt).toLocaleDateString('es-ES')}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {company.id !== currentCompanyId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onCompanyChange(company.id)
                          toast.success(`Cambiado a ${company.name}`)
                        }}
                      >
                        Activar
                      </Button>
                    )}
                    {company.role === 'owner' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteCompany(company.id)}
                      >
                        <Trash size={16} />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
