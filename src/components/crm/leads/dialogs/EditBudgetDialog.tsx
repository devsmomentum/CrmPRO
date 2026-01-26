import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Budget, BudgetLineItem } from '@/lib/types'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'
import { Plus, Trash, Download } from '@phosphor-icons/react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

interface EditBudgetDialogProps {
  budget: Budget
  open: boolean
  onClose: () => void
  onUpdate: (budget: Budget) => void
}

export function EditBudgetDialog({ budget, open, onClose, onUpdate }: EditBudgetDialogProps) {
  const t = useTranslation('es')
  
  const [name, setName] = useState(budget.name)
  const [items, setItems] = useState<BudgetLineItem[]>(budget.items)
  const [status, setStatus] = useState(budget.status)
  const [taxRate, setTaxRate] = useState(0.16)

  useEffect(() => {
    if (open) {
      setName(budget.name)
      setItems(budget.items)
      setStatus(budget.status)
      
      if (budget.subtotal > 0) {
        const calculatedTax = budget.tax / budget.subtotal
        setTaxRate(calculatedTax)
      }
    }
  }, [budget, open])

  const addItem = () => {
    const newItem: BudgetLineItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0
    }
    setItems([...items, newItem])
  }

  const updateItem = (id: string, field: keyof BudgetLineItem, value: any) => {
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

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id))
  }

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0)
    const tax = subtotal * taxRate
    const total = subtotal + tax
    return { subtotal, tax, total }
  }

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('Ingresa un nombre para el presupuesto')
      return
    }

    if (items.length === 0) {
      toast.error('Agrega al menos un artículo')
      return
    }

    const hasEmptyItems = items.some(item => !item.description.trim())
    if (hasEmptyItems) {
      toast.error('Completa la descripción de todos los artículos')
      return
    }

    const { subtotal, tax, total } = calculateTotals()

    const updatedBudget: Budget = {
      ...budget,
      name: name.trim(),
      items,
      subtotal,
      tax,
      total,
      status
    }

    onUpdate(updatedBudget)
    onClose()
    toast.success('Presupuesto actualizado exitosamente')
  }

  const handleDownload = () => {
    const { subtotal, tax, total } = calculateTotals()
    
    let content = `PRESUPUESTO: ${name}\n`
    content += `Fecha: ${new Date(budget.createdAt).toLocaleDateString()}\n`
    content += `Estado: ${status}\n`
    content += `\n${'='.repeat(80)}\n\n`
    
    content += `DESCRIPCIÓN${' '.repeat(30)}CANT.${' '.repeat(5)}P. UNIT.${' '.repeat(5)}TOTAL\n`
    content += `${'-'.repeat(80)}\n`
    
    items.forEach(item => {
      const desc = item.description.padEnd(40)
      const qty = item.quantity.toString().padStart(5)
      const price = `$${item.unitPrice.toFixed(2)}`.padStart(12)
      const itemTotal = `$${item.total.toFixed(2)}`.padStart(12)
      content += `${desc}${qty}${price}${itemTotal}\n`
    })
    
    content += `\n${'-'.repeat(80)}\n`
    content += `${' '.repeat(60)}Subtotal: $${subtotal.toFixed(2)}\n`
    content += `${' '.repeat(60)}IVA (${(taxRate * 100).toFixed(0)}%): $${tax.toFixed(2)}\n`
    content += `${' '.repeat(60)}TOTAL: $${total.toFixed(2)}\n`
    
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Presupuesto_${name.replace(/\s+/g, '_')}_${Date.now()}.txt`
    link.click()
    URL.revokeObjectURL(url)
    
    toast.success('Presupuesto descargado')
  }

  const { subtotal, tax, total } = calculateTotals()

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Presupuesto</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="budget-name">Nombre del Presupuesto</Label>
              <Input
                id="budget-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Propuesta comercial 2024"
              />
            </div>
            <div>
              <Label htmlFor="budget-status">Estado</Label>
              <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                <SelectTrigger id="budget-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="sent">Enviado</SelectItem>
                  <SelectItem value="approved">Aprobado</SelectItem>
                  <SelectItem value="rejected">Rechazado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-4">
              <Label>Artículos</Label>
              <Button onClick={addItem} size="sm" variant="outline">
                <Plus size={16} className="mr-2" />
                Agregar Artículo
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={item.id} className="flex gap-2 items-start p-3 border border-border rounded-lg">
                  <div className="flex-1 grid grid-cols-12 gap-2">
                    <div className="col-span-5">
                      <Input
                        placeholder="Descripción del artículo"
                        value={item.description}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        placeholder="Cant."
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="1"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        placeholder="Precio"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        value={`$${item.total.toFixed(2)}`}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash size={16} className="text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            {items.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No hay artículos. Haz clic en "Agregar Artículo" para comenzar.
              </p>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">IVA:</span>
                <Input
                  type="number"
                  value={taxRate * 100}
                  onChange={(e) => setTaxRate((parseFloat(e.target.value) || 0) / 100)}
                  className="w-20"
                  min="0"
                  max="100"
                  step="1"
                />
                <span className="text-muted-foreground">%</span>
              </div>
              <span className="font-medium">${tax.toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg">
              <span className="font-semibold">Total:</span>
              <span className="font-bold text-primary">${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleDownload} variant="outline">
              <Download size={16} className="mr-2" />
              Descargar
            </Button>
            <Button onClick={handleSubmit} className="flex-1">Guardar Cambios</Button>
            <Button onClick={onClose} variant="outline">Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
