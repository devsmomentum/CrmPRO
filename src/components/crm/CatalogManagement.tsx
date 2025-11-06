import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Trash, Pencil, Package } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Item } from './ItemSelector'
import { Badge } from '@/components/ui/badge'

export function CatalogManagement() {
  const [catalogItems, setCatalogItems] = useKV<Item[]>('catalog-items', [])
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [itemName, setItemName] = useState('')
  const [itemDescription, setItemDescription] = useState('')
  const [itemPrice, setItemPrice] = useState('')

  const handleCreateItem = () => {
    if (!itemName.trim()) {
      toast.error('El nombre es requerido')
      return
    }

    const newItem: Item = {
      id: Date.now().toString(),
      name: itemName.trim(),
      description: itemDescription.trim() || undefined,
      unitPrice: itemPrice ? parseFloat(itemPrice) : undefined
    }

    setCatalogItems((current) => [...(current || []), newItem])
    resetForm()
    setShowCreateDialog(false)
    toast.success('Artículo creado')
  }

  const handleUpdateItem = () => {
    if (!editingItem || !itemName.trim()) {
      toast.error('El nombre es requerido')
      return
    }

    setCatalogItems((current) =>
      (current || []).map(item =>
        item.id === editingItem.id
          ? {
              ...item,
              name: itemName.trim(),
              description: itemDescription.trim() || undefined,
              unitPrice: itemPrice ? parseFloat(itemPrice) : undefined
            }
          : item
      )
    )
    resetForm()
    setEditingItem(null)
    toast.success('Artículo actualizado')
  }

  const handleDeleteItem = (id: string) => {
    setCatalogItems((current) => (current || []).filter(item => item.id !== id))
    toast.success('Artículo eliminado')
  }

  const handleEditItem = (item: Item) => {
    setEditingItem(item)
    setItemName(item.name)
    setItemDescription(item.description || '')
    setItemPrice(item.unitPrice?.toString() || '')
  }

  const resetForm = () => {
    setItemName('')
    setItemDescription('')
    setItemPrice('')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Catálogo de Artículos</h2>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2" size={20} />
              Nuevo Artículo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Artículo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="item-name">Nombre *</Label>
                <Input
                  id="item-name"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="Consultoría de software"
                />
              </div>

              <div>
                <Label htmlFor="item-description">Descripción</Label>
                <Input
                  id="item-description"
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder="Descripción del artículo"
                />
              </div>

              <div>
                <Label htmlFor="item-price">Precio Unitario</Label>
                <Input
                  id="item-price"
                  type="number"
                  step="0.01"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <Button onClick={handleCreateItem} className="w-full">
                <Plus className="mr-2" size={20} />
                Crear Artículo
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {(catalogItems || []).map((item) => (
          <Card key={item.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Package size={20} className="text-muted-foreground" />
                    <h3 className="font-semibold">{item.name}</h3>
                  </div>
                  {item.description && (
                    <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                  )}
                  {item.unitPrice !== undefined && (
                    <Badge variant="secondary" className="mt-2">
                      ${item.unitPrice.toFixed(2)}
                    </Badge>
                  )}
                </div>

                <div className="flex gap-2">
                  <Dialog open={editingItem?.id === item.id} onOpenChange={(open) => !open && setEditingItem(null)}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditItem(item)}
                      >
                        <Pencil size={16} />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Editar Artículo</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="edit-item-name">Nombre *</Label>
                          <Input
                            id="edit-item-name"
                            value={itemName}
                            onChange={(e) => setItemName(e.target.value)}
                            placeholder="Consultoría de software"
                          />
                        </div>

                        <div>
                          <Label htmlFor="edit-item-description">Descripción</Label>
                          <Input
                            id="edit-item-description"
                            value={itemDescription}
                            onChange={(e) => setItemDescription(e.target.value)}
                            placeholder="Descripción del artículo"
                          />
                        </div>

                        <div>
                          <Label htmlFor="edit-item-price">Precio Unitario</Label>
                          <Input
                            id="edit-item-price"
                            type="number"
                            step="0.01"
                            value={itemPrice}
                            onChange={(e) => setItemPrice(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>

                        <Button onClick={handleUpdateItem} className="w-full">
                          Actualizar Artículo
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteItem(item.id)}
                  >
                    <Trash size={16} />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(catalogItems || []).length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-2">
              <Package size={48} className="mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">No hay artículos en el catálogo</p>
              <p className="text-sm text-muted-foreground">Crea artículos para usar en presupuestos</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
