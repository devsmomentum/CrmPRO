import { useState } from 'react'
// Eliminamos useKV de Spark para evitar errores 401 Unauthorized
// import { useKV } from '@github/spark/hooks'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Budget, BudgetLineItem } from '@/lib/types'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'
import { Plus, Trash } from '@phosphor-icons/react'
import { ItemSelector, Item } from '@/components/crm/ItemSelector'

interface AddBudgetDialogProps {
  leadId: string
  open: boolean
  onClose: () => void
  onAdd: (budget: Budget) => void
}

export function AddBudgetDialog({ leadId, open, onClose, onAdd }: AddBudgetDialogProps) {
  const t = useTranslation('es')
  // Usamos estado local en lugar de useKV para evitar errores 401
  const [catalogItems, setCatalogItems] = useState<Item[]>([])
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'draft' | 'sent' | 'approved' | 'rejected'>('draft')
  const [items, setItems] = useState<BudgetLineItem[]>([
    { id: '1', description: '', quantity: 1, unitPrice: 0, total: 0 }
  ])
  const [tax, setTax] = useState(0)

  const handleAddItem = () => {
    setItems([...items, {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0
    }])
  }

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id))
  }

  const handleItemChange = (id: string, field: keyof BudgetLineItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value }
        if (field === 'quantity' || field === 'unitPrice') {
          updated.total = updated.quantity * updated.unitPrice
        }
        return updated
      }
      return item
    }))
  }

  const handleSelectCatalogItem = (itemId: string, catalogItem: Item) => {
    handleItemChange(itemId, 'description', catalogItem.name)
    if (catalogItem.unitPrice) {
      handleItemChange(itemId, 'unitPrice', catalogItem.unitPrice)
    }
  }

  const handleCreateCatalogItem = (newItem: Item) => {
    setCatalogItems((current) => [...(current || []), newItem])
    toast.success('Artículo creado y guardado en el catálogo')
  }

  const subtotal = items.reduce((sum, item) => sum + item.total, 0)
  const total = subtotal + tax

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error(t.messages.fillRequired)
      return
    }

    const newBudget: Budget = {
      id: Date.now().toString(),
      leadId,
      name: name.trim(),
      items,
      subtotal,
      tax,
      total,
      status,
      createdAt: new Date()
    }

    onAdd(newBudget)
    resetForm()
    onClose()
    toast.success(t.messages.budgetCreated)
  }

  const resetForm = () => {
    setName('')
    setStatus('draft')
    setItems([{ id: '1', description: '', quantity: 1, unitPrice: 0, total: 0 }])
    setTax(0)
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.budget.newBudget}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="budget-name">{t.budget.name}</Label>
              <Input
                id="budget-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Propuesta comercial 2024"
              />
            </div>
            <div>
              <Label htmlFor="budget-status">{t.budget.status}</Label>
              <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                <SelectTrigger id="budget-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{t.budget.draft}</SelectItem>
                  <SelectItem value="sent">{t.budget.sent}</SelectItem>
                  <SelectItem value="approved">{t.budget.approved}</SelectItem>
                  <SelectItem value="rejected">{t.budget.rejected}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Items</Label>
              <Button onClick={handleAddItem} size="sm" variant="outline">
                <Plus size={16} className="mr-2" />
                {t.budget.addItem}
              </Button>
            </div>

            {items.map((item, index) => (
              <div key={item.id} className="space-y-2 pb-3 border-b last:border-b-0">
                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-11">
                    <ItemSelector
                      items={catalogItems || []}
                      value={catalogItems?.find(ci => ci.name === item.description)}
                      onSelect={(catalogItem) => handleSelectCatalogItem(item.id, catalogItem)}
                      onCreate={handleCreateCatalogItem}
                      label={index === 0 ? t.budget.description : undefined}
                      placeholder="Seleccionar o crear artículo..."
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      onClick={() => handleRemoveItem(item.id)}
                      size="sm"
                      variant="ghost"
                      className="h-10 w-10 p-0 text-destructive"
                      disabled={items.length === 1}
                    >
                      <Trash size={16} />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-4">
                    <Label className="text-xs">{t.budget.quantity}</Label>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                      className="text-sm h-9"
                    />
                  </div>
                  <div className="col-span-4">
                    <Label className="text-xs">{t.budget.unitPrice}</Label>
                    <Input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="text-sm h-9"
                    />
                  </div>
                  <div className="col-span-4">
                    <Label className="text-xs">{t.budget.total}</Label>
                    <Input
                      value={`$${item.total.toFixed(2)}`}
                      disabled
                      className="text-sm font-medium h-9"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium">{t.budget.subtotal}</span>
              <span className="text-lg">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center gap-4">
              <Label htmlFor="budget-tax">{t.budget.tax}</Label>
              <Input
                id="budget-tax"
                type="number"
                value={tax}
                onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                className="w-32"
              />
            </div>
            <div className="flex justify-between items-center text-xl font-bold pt-2 border-t">
              <span>{t.budget.total}</span>
              <span className="text-primary">${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSubmit} className="flex-1">{t.budget.save}</Button>
            <Button onClick={onClose} variant="outline">{t.buttons.cancel}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
