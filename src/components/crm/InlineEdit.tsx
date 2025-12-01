import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PencilSimple, Check, X } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface InlineEditProps {
  value: string | number
  onSave: (value: string | number) => void
  type?: 'text' | 'email' | 'number' | 'tel' | 'textarea'
  className?: string
  displayClassName?: string
  prefix?: string
  suffix?: string
  multiline?: boolean
  disabled?: boolean
}

export function InlineEdit({ 
  value, 
  onSave, 
  type = 'text',
  className,
  displayClassName,
  prefix = '',
  suffix = '',
  multiline = false,
  disabled = false
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value.toString())
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select()
      }
    }
  }, [isEditing])

  const handleSave = () => {
    const finalValue = type === 'number' ? Number(editValue) : editValue
    if (finalValue !== value) {
      onSave(finalValue)
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(value.toString())
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (!isEditing) {
    return (
      <div 
        className={cn(
          'group inline-flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1 transition-colors',
          displayClassName,
          disabled && "cursor-default hover:bg-transparent"
        )}
        onClick={() => !disabled && setIsEditing(true)}
      >
        <span>
          {prefix}{value}{suffix}
        </span>
        {!disabled && (
          <PencilSimple 
            size={14} 
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" 
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {multiline ? (
        <Textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn('min-h-[60px]', className)}
        />
      ) : (
        <Input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={className}
        />
      )}
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0 text-success hover:text-success"
        onClick={handleSave}
      >
        <Check size={16} />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
        onClick={handleCancel}
      >
        <X size={16} />
      </Button>
    </div>
  )
}
