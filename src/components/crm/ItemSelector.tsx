import { useState, useRef, useEffect } from 'react'
import { Check, Plus, X } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'

export interface Item {
  id: string
  name: string
  description?: string
  unitPrice?: number
}

interface ItemSelectorProps {
  items: Item[]
  value?: Item
  onSelect: (item: Item) => void
  onCreate: (item: Item) => void
  label?: string
  placeholder?: string
  className?: string
}

export function ItemSelector({ 
  items, 
  value, 
  onSelect, 
  onCreate, 
  label, 
  placeholder = 'Seleccionar artículo...',
  className 
}: ItemSelectorProps) {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')
  const [newItemDescription, setNewItemDescription] = useState('')

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchValue.toLowerCase())
  )

  const handleCreate = () => {
    if (!newItemName.trim()) return

    const newItem: Item = {
      id: Date.now().toString(),
      name: newItemName.trim(),
      description: newItemDescription.trim() || undefined,
      unitPrice: newItemPrice ? parseFloat(newItemPrice) : undefined
    }

    onCreate(newItem)
    onSelect(newItem)
    setIsCreating(false)
    setNewItemName('')
    setNewItemPrice('')
    setNewItemDescription('')
    setOpen(false)
  }

  const handleSelectItem = (item: Item) => {
    onSelect(item)
    setOpen(false)
  }

  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label>{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {value ? value.name : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          {!isCreating ? (
            <Command>
              <CommandInput 
                placeholder="Buscar artículo..." 
                value={searchValue}
                onValueChange={setSearchValue}
              />
              <CommandList>
                <CommandEmpty>
                  <div className="py-6 text-center space-y-3">
                    <p className="text-sm text-muted-foreground">No se encontró el artículo</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setIsCreating(true)
                        setNewItemName(searchValue)
                      }}
                    >
                      <Plus className="mr-2" size={16} />
                      Crear "{searchValue}"
                    </Button>
                  </div>
                </CommandEmpty>
                <CommandGroup>
                  {filteredItems.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.name}
                      onSelect={() => handleSelectItem(item)}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex-1">
                          <div className="font-medium">{item.name}</div>
                          {item.description && (
                            <div className="text-xs text-muted-foreground">{item.description}</div>
                          )}
                        </div>
                        {item.unitPrice && (
                          <div className="text-sm text-muted-foreground ml-2">
                            ${item.unitPrice.toFixed(2)}
                          </div>
                        )}
                        {value?.id === item.id && (
                          <Check className="ml-2" size={16} />
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
              <div className="border-t p-2">
                <Button 
                  variant="ghost" 
                  className="w-full justify-start"
                  onClick={() => setIsCreating(true)}
                >
                  <Plus className="mr-2" size={16} />
                  Crear nuevo artículo
                </Button>
              </div>
            </Command>
          ) : (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Crear Nuevo Artículo</h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setIsCreating(false)
                    setNewItemName('')
                    setNewItemPrice('')
                    setNewItemDescription('')
                  }}
                >
                  <X size={16} />
                </Button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="new-item-name">Nombre *</Label>
                  <Input
                    id="new-item-name"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Nombre del artículo"
                    autoFocus
                  />
                </div>
                
                <div>
                  <Label htmlFor="new-item-description">Descripción</Label>
                  <Input
                    id="new-item-description"
                    value={newItemDescription}
                    onChange={(e) => setNewItemDescription(e.target.value)}
                    placeholder="Descripción opcional"
                  />
                </div>
                
                <div>
                  <Label htmlFor="new-item-price">Precio Unitario</Label>
                  <Input
                    id="new-item-price"
                    type="number"
                    step="0.01"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={handleCreate} 
                    className="flex-1"
                    disabled={!newItemName.trim()}
                  >
                    <Plus className="mr-2" size={16} />
                    Crear
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setIsCreating(false)
                      setNewItemName('')
                      setNewItemPrice('')
                      setNewItemDescription('')
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
