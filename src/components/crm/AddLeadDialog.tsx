import { useEffect, useState, useMemo, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Plus, Upload, FileX, Check, Warning, Spinner, Trash } from '@phosphor-icons/react'
import { Lead, PipelineType, Stage, TeamMember } from '@/lib/types'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'
import { Company } from './CompanyManagement'
import { usePersistentState } from '@/hooks/usePersistentState'
import * as XLSX from 'xlsx'
import { createLead, createLeadsBulk } from '@/supabase/services/leads'
import { supabase } from '@/lib/supabase'
import { Progress } from '@/components/ui/progress'

// Lazy load PDF.js to avoid worker issues
let pdfjsLib: any = null
const loadPdfJs = async () => {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist')
    // Use local worker from node_modules
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString()
  }
  return pdfjsLib
}

// Detecta fechas tipo DD/MM/YYYY o DD-MM-YYYY (con validación básica de día/mes/año)
const isDateLike = (str: string) => {
  if (!str) return false
  const s = String(str).trim()
  const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/)
  if (!m) return false
  const d = Number(m[1])
  const mo = Number(m[2])
  const yy = m[3]
  const y = yy.length === 2 ? 2000 + Number(yy) : Number(yy)
  if (Number.isNaN(d) || Number.isNaN(mo) || Number.isNaN(y)) return false
  if (d < 1 || d > 31) return false
  if (mo < 1 || mo > 12) return false
  if (y < 1900 || y > 2100) return false
  return true
}

// Detecta valores de fecha provenientes de Excel (string fecha, Date o serial numérico)
const isDateValue = (val: any) => {
  if (val == null) return false
  if (val instanceof Date) return true
  if (typeof val === 'number') {
    // Rangos típicos de serial de Excel (aprox.)
    return val > 20000 && val < 90000
  }
  return isDateLike(String(val))
}

// Si el valor empieza con una fecha (23/12/2025 Nombre), devuelve solo el resto.
const stripLeadingDate = (val: any) => {
  if (val == null) return ''
  if (val instanceof Date) return ''
  const s = String(val).trim()
  if (!s) return ''
  const m = s.match(/^(\d{1,2}[\/-]\d{1,2}[\/-](\d{2}|\d{4}))\s*[,:;\-]*\s*(.+)$/)
  if (m) {
    const rest = m[3].trim()
    return rest
  }
  return s
}

// Quita un token de día suelto al inicio ("25 Carlos" -> "Carlos").
const stripLeadingDayToken = (val: any) => {
  if (val == null) return ''
  const s = String(val).trim()
  if (!s) return ''
  return s.replace(/^\d{1,2}\s+/, '').trim()
}

const cleanNameValue = (val: any) => stripLeadingDayToken(stripLeadingDate(val))

interface User {
  id: string
  email: string
  businessName: string
}

interface AddLeadDialogProps {
  pipelineType: PipelineType
  pipelineId?: string
  stages: Stage[]
  teamMembers: TeamMember[]
  onAdd: (lead: Lead) => void
  onImport?: (leads: Lead[]) => void
  trigger?: React.ReactNode
  defaultStageId?: string
  companies?: Company[]
  currentUser?: User | null
  companyName?: string // nombre de la empresa activa
  companyId?: string
}

interface PreviewRow {
  nombre_completo?: string
  telefono?: string
  correo_electronico?: string
  empresa?: string
  ubicacion?: string
  presupuesto?: number
  notas?: string
  isValid: boolean
  error?: string
}

// Límite máximo de presupuesto: 10 millones de dólares
const MAX_BUDGET = 10_000_000

export function AddLeadDialog({ pipelineType, pipelineId, stages, teamMembers, onAdd, onImport, trigger, defaultStageId, companies = [], currentUser, companyName, companyId }: AddLeadDialogProps) {
  const t = useTranslation('es')
  const [open, setOpen] = useState(false)
  const [localUser] = usePersistentState<User | null>('current-user', null)

  // Priorizar currentUser prop, luego localUser.
  // Si no hay usuario, usar un objeto dummy (aunque idealmente siempre debería haber usuario)
  const effectiveUser = currentUser || localUser

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [location, setLocation] = useState('')
  const [budget, setBudget] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')

  // Usar ID para assignedTo
  const [assignedTo, setAssignedTo] = useState(teamMembers[0]?.id || effectiveUser?.id || '')

  const firstStageId = stages[0]?.id || ''
  const [stageId, setStageId] = useState(defaultStageId || firstStageId)

  const [activeTab, setActiveTab] = useState('manual')
  const [pasteText, setPasteText] = useState('')

  // Excel Import State
  const [file, setFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<PreviewRow[]>([])
  const [importStatus, setImportStatus] = useState<'idle' | 'preview' | 'importing' | 'success'>('idle')
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Miembros elegibles: aquellos cuyo array pipelines incluye el pipeline actual (o no tienen restricción)
  // Siempre incluir "Yo" (effectiveUser) como primera opción, evitando duplicados.
  const eligibleMembers = useMemo(() => {
    const filtered = teamMembers.filter(m => {
      const ps = m.pipelines || []
      if (ps.length === 0) return false
      // Coincidencia por ID de pipeline, por slug/type o por nombre
      if (pipelineId && ps.includes(pipelineId)) return true
      if (ps.includes(pipelineType)) return true
      if (companyName && ps.includes(companyName)) return true
      return false
    })
    if (effectiveUser) {
      const labelBase = companyName || effectiveUser.businessName || effectiveUser.email || 'Yo'
      const userAsMember: TeamMember = {
        id: effectiveUser.id,
        name: `${labelBase} (Yo)`,
        email: effectiveUser.email,
        avatar: '',
        role: 'self',
        pipelines: [],
        permissionRole: 'viewer'
      }
      const withoutUser = filtered.filter(m => m.id !== effectiveUser.id)
      return [userAsMember, ...withoutUser]
    }
    return filtered
  }, [teamMembers, pipelineType, effectiveUser, companyName])

  useEffect(() => {
    setStageId(defaultStageId || firstStageId)
  }, [defaultStageId, firstStageId])

  useEffect(() => {
    if (open) {
      // Si no hay asignado, intentar poner al effectiveUser (ID) o el primer miembro (ID)
      if (!assignedTo) {
        setAssignedTo(teamMembers[0]?.id || effectiveUser?.id || '')
      }
    }
  }, [open, teamMembers, effectiveUser])

  useEffect(() => {
    if (assignedTo === 'todos') return
    if (eligibleMembers.length && !eligibleMembers.find(m => m.id === assignedTo)) {
      setAssignedTo(eligibleMembers[0].id)
    }
  }, [eligibleMembers, assignedTo])

  const processText = () => {
    if (!pasteText.trim()) return

    const lines = pasteText.split('\n')
    let newName = name
    let newEmail = email
    let newPhone = phone
    let newCompany = company
    let newBudget = budget
    let newPriority = priority
    let newAssignedTo = assignedTo

    // Flags para saber si ya asignamos nombre/empresa en esta pasada (para evitar sobrescribir con basura)
    let foundNameInText = false
    let foundCompanyInText = false

    lines.forEach(line => {
      const trimmedLine = line.trim()
      if (!trimmedLine) return
      // Omitir líneas que parezcan fechas (p.ej. 23/12/2025)
      if (isDateLike(trimmedLine)) return

      // 1. Intento de parseo Clave: Valor (Prioridad Alta)
      if (trimmedLine.includes(':')) {
        const parts = trimmedLine.split(':')
        const key = parts[0].trim().toLowerCase()
        const value = parts.slice(1).join(':').trim()

        if (!value) return

        if (['cliente', 'nombre', 'name'].some(k => key.includes(k))) {
          newName = value.replace(/[\[\]]/g, '')
          foundNameInText = true
        } else if (['email', 'correo'].some(k => key.includes(k))) {
          newEmail = value
        } else if (['telefono', 'teléfono', 'celular', 'movil', 'phone'].some(k => key.includes(k))) {
          newPhone = value
        } else if (['empresa', 'compañia', 'negocio', 'company'].some(k => key.includes(k))) {
          newCompany = value
          foundCompanyInText = true
        } else if (['fecha', 'date', 'creado el', 'created at'].some(k => key.includes(k))) {
          // Omitir clave fecha explícita
          return
        } else if (['presupuesto', 'costo', 'valor', 'precio', 'budget'].some(k => key.includes(k))) {
          const num = value.replace(/[^0-9.]/g, '')
          const parsed = parseFloat(num)
          if (num && !isNaN(parsed) && parsed <= MAX_BUDGET) newBudget = num
        } else if (['prioridad', 'priority'].some(k => key.includes(k))) {
          const lowerVal = value.toLowerCase()
          if (lowerVal.includes('alta') || lowerVal.includes('high')) newPriority = 'high'
          else if (lowerVal.includes('media') || lowerVal.includes('medium')) newPriority = 'medium'
          else if (lowerVal.includes('baja') || lowerVal.includes('low')) newPriority = 'low'
        } else if (['vendedor', 'assigned', 'responsable'].some(k => key.includes(k))) {
          const memberName = value.replace(/[\[\]]/g, '').toLowerCase()
          const foundMember = teamMembers.find(m => m.name.toLowerCase().includes(memberName))
          if (foundMember) newAssignedTo = foundMember.id
        } else if (key.includes('contacto')) {
          if (value.includes('@')) newEmail = value
          else newPhone = value
        }
        return
      }

      // 2. Heurísticas para líneas sin formato (Prioridad Baja)

      // Email (contiene @ y .)
      if (trimmedLine.includes('@') && trimmedLine.includes('.')) {
        newEmail = trimmedLine
        return
      }

      // Prioridad (palabras exactas)
      const lowerLine = trimmedLine.toLowerCase()
      if (['alta', 'high', 'urgent'].some(p => lowerLine === p)) {
        newPriority = 'high'
        return
      }
      if (['media', 'medium', 'normal'].some(p => lowerLine === p)) {
        newPriority = 'medium'
        return
      }
      if (['baja', 'low'].some(p => lowerLine === p)) {
        newPriority = 'low'
        return
      }

      // Teléfono vs Presupuesto
      const digitsOnly = trimmedLine.replace(/[^0-9]/g, '')
      const isCurrencyOrNumber = /^[0-9.,$]+$/.test(trimmedLine)

      // Si parece teléfono (tiene +, -, () o empieza con 0/3/5/6 y es largo)
      if (/^[+\d\s()-]+$/.test(trimmedLine) && digitsOnly.length >= 7) {
        // Si tiene formato explícito de teléfono o es muy largo para ser presupuesto simple sin contexto
        if (trimmedLine.includes('-') || trimmedLine.includes('(') || trimmedLine.startsWith('+') || digitsOnly.length > 8) {
          newPhone = trimmedLine
          return
        }
      }

      // Si es solo números (y no lo capturó el teléfono arriba), asumimos presupuesto
      if (isCurrencyOrNumber) {
        const num = trimmedLine.replace(/[^0-9.]/g, '')
        const parsed = parseFloat(num)
        if (num && !isNaN(parsed) && parsed <= MAX_BUDGET) {
          newBudget = num
          return
        }
      }

      // Nombre y Empresa (Fallback)
      // Si no hemos encontrado nombre en este texto y el campo actual está vacío (o queremos priorizar el texto pegado)
      // Asumimos que la primera línea de texto libre es el Nombre
      if (!foundNameInText && !newName) {
        // Evitar usar fechas como nombre
        if (!isDateLike(trimmedLine)) {
          newName = trimmedLine
        }
        foundNameInText = true
        return
      }
      // La segunda línea de texto libre sería la Empresa
      if (!foundCompanyInText && !newCompany) {
        newCompany = trimmedLine
        foundCompanyInText = true
        return
      }
    })

    setName(newName)
    setEmail(newEmail)
    setPhone(newPhone)
    setCompany(newCompany)
    setBudget(newBudget)
    setPriority(newPriority)
    setAssignedTo(newAssignedTo)

    setActiveTab('manual')
    toast.success('Datos procesados. Por favor verifica la información.')
  }

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error(t.messages.fillRequired)
      return
    }

    if (!assignedTo || assignedTo === 'Sin asignar') {
      toast.error('Debes asignar el lead a un miembro del equipo')
      return
    }

    if (!stageId) {
      toast.error(t.pipeline.noStages)
      return
    }

    const newLead: Lead = {
      id: Date.now().toString(),
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      company: company.trim(),
      location: location.trim(),
      pipeline: pipelineType,
      stage: stageId,
      tags: [],
      priority,
      budget: budget ? parseFloat(budget) : 0,
      assignedTo,
      createdAt: new Date(),
      lastContact: new Date()
    }

    onAdd(newLead)
    resetForm()
    setOpen(false)
    toast.success(t.messages.leadAdded)
  }

  // --- File Import Logic (Excel + PDF) ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setImportStatus('preview')

    try {
      const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase()

      if (fileExtension === 'pdf') {
        await parsePDF(selectedFile)
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        await parseExcel(selectedFile)
      } else {
        toast.error("Formato no soportado. Use .xlsx, .xls o .pdf")
        setImportStatus('idle')
        setFile(null)
      }
    } catch (err) {
      console.error("Error parsing file", err)
      toast.error("Error al leer el archivo")
      setImportStatus('idle')
      setFile(null)
    }
  }

  const parsePDF = async (file: File) => {
    const pdfjs = await loadPdfJs()
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise

    let allLines: string[] = []

    // Extract text from all pages and reconstruct rows based on Y coordinate
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()

      // Group items by Y coordinate (row) with some tolerance
      const rows: { [key: number]: string[] } = {}

      textContent.items.forEach((item: any) => {
        // PDF coordinates start from bottom-left. Y is distance from bottom.
        // We invert Y to sort top-to-bottom more intuitively if needed, or just use as key.
        // Grouping with tolerance of ~5 units to handle slight misalignments
        const y = Math.round(item.transform[5] / 5) * 5
        if (!rows[y]) rows[y] = []
        rows[y].push(item.str)
      })

      // Sort rows by Y (descending because PDF Y starts at bottom)
      const sortedY = Object.keys(rows).map(Number).sort((a, b) => b - a)

      // Join parts of each row
      const pageLines = sortedY.map(y => rows[y].join('  ')) // Use double space to separate potential columns
      allLines = [...allLines, ...pageLines]
    }

    const mappedData: PreviewRow[] = []

    // Process reconstructed lines
    const lines = allLines.filter(l => l.trim())

    let hasEmpresaHeader = false
    let hasUbicacionHeader = false
    let headerDetected = false

    // Usamos isDateLike global para detectar fechas

    for (const line of lines) {
      const trimmed = line.trim()

      // Skip empty lines or very short lines
      if (trimmed.length < 5) continue

      // Check for header
      if (!headerDetected && /^(nombre|name|telefono|phone|email|correo|fecha|date|empresa|company|ubicacion|location|direccion|lugar)/i.test(trimmed)) {
        if (/empresa|company|negocio/i.test(trimmed)) hasEmpresaHeader = true
        if (/ubicacion|location|direccion|ciudad|pais|lugar|zona/i.test(trimmed)) hasUbicacionHeader = true
        headerDetected = true
        continue // Skip the header line itself
      }

      // Skip lines that look like headers or metadata (if we already detected one or just to be safe)
      if (/^(nombre|name|telefono|phone|email|correo|fecha|date)/i.test(trimmed)) continue

      // Try multiple splitting strategies
      let parts: string[] = []

      // Strategy 1: Split by 2+ spaces (common in PDF tables)
      parts = trimmed.split(/\s{2,}/)

      // Strategy 2: If that didn't work well, try tabs
      if (parts.length < 2) {
        parts = trimmed.split(/\t+/)
      }

      // Strategy 3: If still not enough, try single space but only if we have clear delimiters
      if (parts.length < 2 && trimmed.includes('  ')) {
        parts = trimmed.split(/\s+/)
      }

      if (parts.length < 2) continue // Skip lines that don't look tabular

      // Normalizar partes: quitar prefijos de fecha y descartar celdas que son solo fecha
      const cleanedParts = parts
        .map(p => stripLeadingDate(p))
        .filter(p => p && !isDateValue(p))

      // Try to extract fields from the cleaned parts
      let nombre = ''
      let telefono = ''
      let correo = ''
      let empresa = ''
      let ubicacion = ''
      let presupuesto = 0
      const textParts: string[] = []

      for (const part of cleanedParts) {
        const p = part.trim()

        // Skip empty parts
        if (!p) continue

        // Email detection (must have @ and .)
        if (p.includes('@') && p.includes('.') && p.length > 5) {
          correo = p
        }
        // Phone detection (7+ consecutive digits or formatted phone)
        else if (/\d{7,}/.test(p) || /[\+\(\)\-\s\d]{10,}/.test(p)) {
          // Make sure it's not just a random number (like a year)
          if (!/^\d{4}$/.test(p) && !/^\d{1,2}$/.test(p)) {
            // Normalize PDF phone
            let cleanPhone = p.replace(/\D/g, '')
            if (cleanPhone.startsWith('0')) {
              cleanPhone = '58' + cleanPhone.substring(1)
            } else if (cleanPhone.length === 10 && (cleanPhone.startsWith('4') || cleanPhone.startsWith('2'))) {
              cleanPhone = '58' + cleanPhone
            }
            telefono = cleanPhone
          }
        }
        // Presupuesto / currency-like number (contains $ or thousand separators)
        else if (/\$/.test(p) || /^(?:\d{1,3}(?:[\.,]\d{3})+|\d+)(?:[\.,]\d+)?$/.test(p)) {
          const num = p.replace(/[^0-9.]/g, '')
          const parsed = parseFloat(num)
          if (!Number.isNaN(parsed)) {
            presupuesto = parsed
          }
        }
        // Name/Company token: text with letters, at least 3 chars, not a keyword
        else if (/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(p) && p.length > 2) {
          // Skip common keywords
          if (!/^(date|fecha|nombre|name|phone|telefono|email|correo)$/i.test(p)) {
            textParts.push(p)
          }
        }
      }

      // Assign name + optional company from textual parts
      if (textParts.length > 0) {
        nombre = cleanNameValue(textParts[0]).trim()
        if (textParts.length > 1) {
          const secondPart = stripLeadingDate(textParts[1]).trim()

          if (hasUbicacionHeader && !hasEmpresaHeader) {
            ubicacion = secondPart
          } else if (hasEmpresaHeader && !hasUbicacionHeader) {
            empresa = secondPart
          } else {
            // Default behavior if ambiguous or both present (assuming company comes first usually)
            // But if we have 3 parts, maybe 2nd is company and 3rd is location?
            empresa = secondPart
            if (textParts.length > 2) {
              ubicacion = stripLeadingDate(textParts[2]).trim()
            }
          }
        }
      }
      // Clean up the name (limit length)
      nombre = nombre.substring(0, 100)

      // Only add if we found at least a name
      if (nombre && !isDateLike(nombre)) {
        mappedData.push({
          nombre_completo: nombre,
          telefono: telefono,
          correo_electronico: correo,
          empresa,
          ubicacion,
          presupuesto,
          notas: '',
          isValid: !!nombre,
          error: !nombre ? 'Nombre es requerido' : undefined
        })
      }
    }

    setPreviewData(mappedData)
  }

  const parseExcel = async (file: File) => {
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data)
    const worksheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[worksheetName]

    // Convertir a matriz de arrays primero para buscar la cabecera
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

    if (rawData.length === 0) {
      toast.error("El archivo parece estar vacío")
      return
    }

    // Buscar la fila de cabecera (header row)
    let headerRowIndex = 0
    // Expanded keywords list
    const headerKeywords = [
      'nombre', 'nombres', 'name', 'names', 'cliente', 'completo', 'titular', 'contacto',
      'telefono', 'teléfono', 'phone', 'celular', 'cel', 'movil', 'mobile', 'whatsapp', 'wsp', 'tel',
      'correo', 'email', 'e-mail', 'mail', 'direccion', 'dirección', 'empresa', 'company', 'budget', 'presupuesto',
      'ubicacion', 'ubicación', 'location', 'address', 'ciudad', 'city', 'pais', 'country', 'estado', 'provincia', 'municipio', 'sector'
    ]

    let bestMatchIndex = -1
    let maxMatches = 0

    for (let i = 0; i < Math.min(rawData.length, 25); i++) {
      const rowString = JSON.stringify(rawData[i]).toLowerCase()
      const matches = headerKeywords.filter(k => rowString.includes(k)).length

      if (matches > maxMatches) {
        maxMatches = matches
        bestMatchIndex = i
      }

      // Si encontramos una fila con 3 o más coincidencias, es casi seguro la cabecera
      if (matches >= 3) {
        bestMatchIndex = i
        break
      }
    }

    // Si encontramos algo decente (al menos 1 match), usamos esa fila. 
    // Si no, por defecto se usará 0, pero esto ayuda si la fila 0 es metadatos y la cabecera está abajo.
    if (bestMatchIndex !== -1 && maxMatches >= 1) {
      headerRowIndex = bestMatchIndex
    }

    // Re-leer usando la fila detectada como range start
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
    range.s.r = headerRowIndex // Start Row

    const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: range }) as any[]

    // Map columns and validate
    const mappedData: PreviewRow[] = jsonData.map(row => {
      const normalizedRow = Object.keys(row).reduce((acc: any, key) => {
        acc[key.toLowerCase().trim()] = row[key]
        return acc
      }, {})

      // Helper for fuzzy matching
      const normalizePhone = (phone: string | number) => {
        let p = String(phone).replace(/\D/g, '') // Remove non-digits
        if (p.startsWith('0')) {
          p = '58' + p.substring(1)
        } else if (p.length === 10 && (p.startsWith('4') || p.startsWith('2'))) {
          p = '58' + p
        }
        return p
      }

      // Pick a value ensuring we don't reuse the same header for two fields
      // skipDateCheck: if true, don't filter out values that look like dates (needed for budget/numeric fields)
      const pickValue = (keys: string[], used: Set<string>, skipDateCheck = false) => {
        for (const k of keys) {
          if (used.has(k)) continue
          if (normalizedRow[k] !== undefined) {
            const v = normalizedRow[k]
            // Skip date check for numeric fields like presupuesto
            if (!skipDateCheck && isDateValue(v)) continue
            used.add(k)
            return { value: v, key: k }
          }
        }
        return { value: '', key: '' }
      }

      const usedKeys = new Set<string>()

      const nombre = cleanNameValue(
        pickValue(['nombre', 'name', 'nombre completo', 'nombres', 'cliente', 'contacto', 'full name', 'titular'], usedKeys).value
      )
      const rawTelefono = pickValue(['telefono', 'teléfono', 'phone', 'celular', 'cel', 'movil', 'mobile', 'whatsapp', 'tel'], usedKeys).value
      const correo = stripLeadingDate(
        pickValue(['correo', 'email', 'e-mail', 'mail', 'correo electronico', 'correo electrónico', 'email address'], usedKeys).value
      )
      const ubicacionPick = pickValue([
        'ubicacion', 'ubicación', 'location', 'address', 'ciudad', 'city', 'pais', 'country', 'direccion', 'dirección',
        'estado', 'provincia', 'municipio', 'sector', 'entidad', 'region', 'región', 'localidad',
        'lugar', 'zona', 'sede', 'sucursal', 'agencia', 'oficina', 'plaza', 'poblacion', 'población'
      ], usedKeys)
      const empresaKeys = ['empresa', 'company', 'compañia', 'compañía', 'negocio', 'organizacion', 'organización', 'razon social', 'firma']
      const empresaPick = pickValue(empresaKeys, usedKeys)

      let empresa = stripLeadingDate(empresaPick.value)
      let ubicacion = stripLeadingDate(ubicacionPick.value)

      // Fallback: si no se detectó ubicación pero existe una columna con "ubic" o "direcc" en el nombre
      if (!ubicacion) {
        const ubicKey = Object.keys(normalizedRow).find(k =>
          k.includes('ubic') || k.includes('direcc') || k.includes('lugar') || k.includes('zona')
        )
        if (ubicKey) {
          ubicacion = stripLeadingDate(normalizedRow[ubicKey])
          // Evitar duplicar en empresa si proviene de la misma columna
          if (empresaPick.key === ubicKey) {
            empresa = ''
          }
        }
      }

      // Si no existe ninguna cabecera de empresa, fuerza empresa vacía
      const hasEmpresaHeader = Object.keys(normalizedRow).some(k => empresaKeys.includes(k))
      if (!hasEmpresaHeader) {
        empresa = ''
      }

      // Expanded budget keywords - use skipDateCheck=true to avoid filtering numeric values
      const presupuestoKeys = [
        'presupuesto', 'budget', 'monto', 'valor', 'precio', 'costo', 'cost',
        'amount', 'total', 'importe', 'cuota', 'fee', 'tarifa', 'rate',
        'inversion', 'inversión', 'investment', 'pago', 'payment', 'cotizacion',
        'cotización', 'quote', 'estimado', 'estimate', 'price'
      ]
      // IMPORTANT: Skip date check for budget - numbers like 25000, 50000 should not be treated as dates
      const rawPresupuesto = pickValue(presupuestoKeys, usedKeys, true).value

      // Parse budget - handle various formats
      const parsePresupuesto = (val: any): number => {
        if (val === null || val === undefined || val === '') return 0
        if (typeof val === 'number') return val

        let str = String(val).trim()
        // Remove currency symbols and text
        str = str.replace(/[^\d.,\-]/g, '')
        if (!str) return 0

        // Handle European format (1.000,50) vs US format (1,000.50)
        const hasCommaAsDecimal = /\d,\d{1,2}$/.test(str)
        const hasDotAsDecimal = /\d\.\d{1,2}$/.test(str)

        if (hasCommaAsDecimal && !hasDotAsDecimal) {
          // European: 1.000,50 -> 1000.50
          str = str.replace(/\./g, '').replace(',', '.')
        } else {
          // US/Standard: 1,000.50 -> 1000.50
          str = str.replace(/,/g, '')
        }

        const num = parseFloat(str)
        return Number.isNaN(num) ? 0 : Math.abs(num)
      }

      const presupuesto = parsePresupuesto(rawPresupuesto)
      const notas = pickValue(['notas', 'notes', 'comentarios', 'observaciones', 'description'], usedKeys).value

      const telefono = isDateValue(rawTelefono) ? '' : normalizePhone(stripLeadingDate(String(rawTelefono)))

      const isValid = !!nombre // Name is required minimally

      // Si la fila está vacía (sin nombre, tel, correo ni empresa), la marcamos para filtrar
      if (!nombre && !telefono && !correo && !empresa) {
        return null
      }

      return {
        nombre_completo: String(nombre).trim(),
        telefono: String(telefono).trim(),
        correo_electronico: String(correo).trim(),
        empresa: String(empresa).trim(),
        ubicacion: String(ubicacion).trim(),
        presupuesto: Number(presupuesto) || 0,
        notas: String(notas).trim(),
        isValid,
        error: !isValid ? 'Nombre es requerido' : undefined
      }
    }).filter(Boolean) as PreviewRow[]

    // Deduplicate within the file itself
    const seenEmails = new Set<string>()
    const seenPhones = new Set<string>()

    // Fetch existing leads to check for duplicates in DB
    const effectiveCompanyId = companyId || (companies && companies.length > 0 ? companies[0].id : undefined)
    if (!effectiveCompanyId) {
      // Si no hay empresa, no podemos deduplicar contra BD; seguimos con dedupe local
      console.warn('No companyId available for DB dedupe; skipping DB duplicate check')
    }

    let existingLeadsMaps: { emails: Set<string>, phones: Set<string> } = { emails: new Set(), phones: new Set() }

    try {
      // Optimización: Traer solo columnas necesarias para chequear duplicados
      if (effectiveCompanyId) {
        const { data: existingData } = await supabase
          .from('lead')
          .select('correo_electronico, telefono')
          .eq('empresa_id', effectiveCompanyId)

        if (existingData) {
          existingData.forEach((l: any) => {
            if (l.correo_electronico) existingLeadsMaps.emails.add(String(l.correo_electronico).toLowerCase().trim())
            if (l.telefono) existingLeadsMaps.phones.add(String(l.telefono).replace(/\D/g, ''))
          })
        }
      }
    } catch (err) {
      console.error('Error fetching existing leads for deduplication', err)
    }

    const processedData = mappedData.map(row => {
      const email = row.correo_electronico?.toLowerCase().trim()
      const rawPhone = row.telefono ? String(row.telefono).replace(/\D/g, '') : ''

      // 1. Check if valid
      if (!row.isValid) return row

      // 2. Check internal duplicates (in the same file)
      if (email && seenEmails.has(email)) {
        return { ...row, isValid: false, error: 'Duplicado en este archivo (Email)' }
      }
      if (rawPhone && rawPhone.length > 6 && seenPhones.has(rawPhone)) {
        return { ...row, isValid: false, error: 'Duplicado en este archivo (Teléfono)' }
      }

      // 3. Check DB duplicates
      if (email && existingLeadsMaps.emails.has(email)) {
        return { ...row, isValid: false, error: 'Ya existe en el CRM (Email)' }
      }
      if (rawPhone && rawPhone.length > 6 && existingLeadsMaps.phones.has(rawPhone)) {
        return { ...row, isValid: false, error: 'Ya existe en el CRM (Teléfono)' }
      }

      // Add to sets
      if (email) seenEmails.add(email)
      if (rawPhone && rawPhone.length > 6) seenPhones.add(rawPhone)

      return row
    })

    setPreviewData(processedData)
  }

  const handleImport = async () => {
    // No fallback: companyId must be provided to avoid inserting en la empresa equivocada
    const effectiveCompanyId = companyId
    const effectivePipelineId = pipelineId
    const NIL_UUID = '00000000-0000-0000-0000-000000000000'

    console.log('handleImport debug:', {
      propCompanyId: companyId,
      effectiveCompanyId,
      stageId,
      pipelineId: effectivePipelineId,
      companiesLen: companies?.length
    })

    if (!stageId) {
      toast.error('Debes seleccionar una etapa inicial para los leads')
      return
    }

    const stageExists = stages.some(s => s.id === stageId)
    if (!stageExists) {
      toast.error('La etapa seleccionada no existe o no está sincronizada. Guarda el pipeline y vuelve a intentar.')
      return
    }

    if (!effectivePipelineId) {
      toast.error('Error crítico: Falta ID de pipeline. Guarda el pipeline o recarga antes de importar.')
      console.error('Missing pipelineId', { pipelineId, pipelineType })
      return
    }

    if (!effectiveCompanyId) {
      toast.error('Error crítico: Falta ID de compañía. No se puede importar.')
      console.error('Missing companyId', { companyId, companies })
      return
    }

    setImportStatus('importing')

    let successCount = 0
    let errorsCount = 0

    const validRows = previewData.filter(r => r.isValid)
    const importedLeads: Lead[] = []
    const BATCH_SIZE = 50
    const totalBatches = Math.ceil(validRows.length / BATCH_SIZE)

    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE)
      const batchLeads = batch.map(row => ({
        nombre_completo: row.nombre_completo,
        telefono: row.telefono,
        correo_electronico: row.correo_electronico,
        empresa: row.empresa,
        ubicacion: row.ubicacion,
        presupuesto: row.presupuesto,
        empresa_id: effectiveCompanyId,
        pipeline_id: effectivePipelineId,
        etapa_id: stageId,
        asignado_a: NIL_UUID,
        prioridad: 'medium'
      }))

      try {
        const result = await createLeadsBulk(batchLeads)

        if (result && Array.isArray(result)) {
          successCount += result.length
          // Add to local list for UI update
          result.forEach(r => {
            importedLeads.push({
              id: r.id,
              name: r.nombre_completo || '',
              email: r.correo_electronico || '',
              phone: r.telefono || '',
              company: r.empresa || '',
              location: r.ubicacion || '',
              budget: r.presupuesto || 0,
              stage: r.etapa_id || stageId,
              pipeline: r.pipeline_id || pipelineId || pipelineType,
              priority: (r.prioridad as 'low' | 'medium' | 'high') || 'medium',
              assignedTo: r.asignado_a || '',
              tags: [],
              createdAt: r.created_at ? new Date(r.created_at) : new Date(),
              lastContact: r.created_at ? new Date(r.created_at) : new Date()
            })
          })
        }
      } catch (err: any) {
        console.error('Error importing batch:', err)
        errorsCount += batch.length

        // Handle specific Foreign Key errors
        let errorMsg = err.message || 'Error desconocido'
        if (err.code === '23503' || String(err.message).includes('foreign key constraint')) {
          if (String(err.message).includes('etapa_id')) {
            errorMsg = 'La etapa seleccionada no existe en la base de datos. Asegúrate de que el pipeline esté guardado.'
          } else if (String(err.message).includes('pipeline_id')) {
            errorMsg = 'El pipeline seleccionado no es válido o no está guardado.'
          } else if (String(err.message).includes('empresa_id')) {
            errorMsg = 'ID de compañía inválido.'
          }
        }

        if (errorsCount <= BATCH_SIZE) {
          toast.error(`Error al importar lote: ${errorMsg}`)
          console.error('Batch error details:', err)
        }
      }

      // Update progress 
      const currentProgress = Math.round(((i + BATCH_SIZE) / validRows.length) * 100)
      setProgress(Math.min(currentProgress, 100))
      console.log(`Processed batch ${Math.ceil((i + 1) / BATCH_SIZE)} of ${totalBatches}`)
    }

    setImportStatus('success')
    toast.success(`Importación finalizada: ${successCount} leads creados. ${errorsCount > 0 ? `${errorsCount} errores.` : ''}`)

    if (successCount === 0) {
      toast.error('No se creó ningún lead. Verifica que el pipeline y la etapa estén guardados y vuelve a intentar.')
    }

    if (importedLeads.length > 0 && onImport) {
      onImport(importedLeads)
    }

    // Call onAdd for each imported lead (or refactor onAdd to accept array)
    // For now, since onAdd expects single lead, we might just rely on parent refresh or refresh locally?
    // The parent PipelineView usually has a realtime listener or we can trigger a refresh.
    // Ideally we should tell parent to refresh. For now let's just close dialog.
    // If we want to update UI immediately we'd need to emit them.
    // Let's optimize by just closing and letting parent refresh via realtime or manual callback if onAdd supported array

    // Hack: trigger onAdd for the last one just to close effectively or maybe loop?
    // Better: Assume parent handles realtime, or we can just close.

    // We do NOT call onAdd here because that would trigger a second DB insert (since handleAddLead in PipelineView creates a lead).
    // The bulk import above already created them.
    // The UI should update via Realtime subscription or manual refresh.

    setTimeout(() => {
      resetForm()
      setOpen(false)
    }, 1500)
  }

  // Handlers for editable preview table
  const handleCellEdit = (index: number, field: keyof PreviewRow, value: any) => {
    const updatedData = [...previewData]
    updatedData[index] = {
      ...updatedData[index],
      [field]: value
    }

    // Re-validate the row
    const row = updatedData[index]
    row.isValid = !!row.nombre_completo
    row.error = !row.isValid ? 'Nombre es requerido' : undefined

    setPreviewData(updatedData)
  }

  const handleDeleteRow = (index: number) => {
    const updatedData = previewData.filter((_, i) => i !== index)
    setPreviewData(updatedData)
    toast.info('Fila eliminada')
  }

  const handleAddRow = () => {
    const newRow: PreviewRow = {
      nombre_completo: '',
      telefono: '',
      correo_electronico: '',
      empresa: '',
      ubicacion: '',
      presupuesto: 0,
      notas: '',
      isValid: false,
      error: 'Nombre es requerido'
    }
    setPreviewData([...previewData, newRow])
    toast.info('Nueva fila añadida')
  }

  const resetForm = () => {
    setName('')
    setEmail('')
    setPhone('')
    setCompany('')
    setLocation('')
    setBudget('')
    setPriority('medium')
    setAssignedTo(teamMembers[0]?.id || effectiveUser?.id || '')
    setStageId(defaultStageId || firstStageId)
    setPasteText('')

    setFile(null)
    setPreviewData([])
    setImportStatus('idle')

    setActiveTab('manual')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="mr-2" size={20} />
            {t.pipeline.addLead}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className={`max-h-[90vh] overflow-y-auto transition-all duration-300 ${activeTab === 'excel' && previewData.length > 0
        ? 'max-w-[95vw] md:max-w-5xl lg:max-w-6xl'
        : 'max-w-md sm:max-w-xl md:max-w-2xl'
        }`}>
        <DialogHeader>
          <DialogTitle>{t.pipeline.addLead}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="manual">Manual</TabsTrigger>
            <TabsTrigger value="paste">Pegar Rápido</TabsTrigger>
            <TabsTrigger value="excel">Importar Excel</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4">
            <div>
              <Label htmlFor="lead-name">{t.lead.name} *</Label>
              <Input
                id="lead-name"
                value={name}
                onChange={(e) => {
                  if (e.target.value.length <= 30) setName(e.target.value)
                }}
                placeholder="Nombre del Lead"
              />
            </div>
            <div>
              <Label htmlFor="lead-email">{t.lead.email}</Label>
              <Input
                id="lead-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="juan@empresa.com"
              />
            </div>
            <div>
              <Label htmlFor="lead-phone">{t.lead.phone}</Label>
              <Input
                id="lead-phone"
                value={phone}
                onChange={(e) => {
                  const val = e.target.value
                  if (val.length <= 15 && !/[a-zA-Z]/.test(val)) {
                    setPhone(val)
                  }
                }}
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <div>
              <Label htmlFor="lead-company">{t.lead.company}</Label>
              <Input
                id="lead-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Nombre de la empresa"
              />
            </div>
            <div>
              <Label htmlFor="lead-location">Ubicación</Label>
              <Input
                id="lead-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ej. Ciudad, País o Dirección"
              />
            </div>
            <div>
              <Label htmlFor="lead-budget">{t.lead.budget}</Label>
              <Input
                id="lead-budget"
                type="number"
                min="0"
                value={budget}
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  if (val < 0 || val > MAX_BUDGET) {
                    toast.error(`El presupuesto no puede superar $${MAX_BUDGET.toLocaleString()} `)
                    return
                  }
                  setBudget(e.target.value)
                }}
                max={MAX_BUDGET}
                placeholder="10000"
              />
            </div>
            {stages.length > 0 && (
              <div>
                <Label htmlFor="lead-stage">{t.stage.name}</Label>
                <Select value={stageId} onValueChange={setStageId}>
                  <SelectTrigger id="lead-stage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map(stage => (
                      <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="lead-priority">{t.lead.priority}</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                <SelectTrigger id="lead-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t.lead.lowPriority}</SelectItem>
                  <SelectItem value="medium">{t.lead.mediumPriority}</SelectItem>
                  <SelectItem value="high">{t.lead.highPriority}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="lead-assigned">{t.lead.assignTo} *</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger id="lead-assigned">
                  <SelectValue placeholder="Seleccionar miembro" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleMembers.map(member => (
                    <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                  ))}
                  <SelectItem value="todos">Todos</SelectItem>
                  {eligibleMembers.length === 0 && (
                    <SelectItem value="none" disabled>Sin miembros disponibles</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSubmit} className="w-full">{t.buttons.add}</Button>
          </TabsContent>

          <TabsContent value="paste" className="space-y-4">
            <div className="space-y-2">
              <Label>Instrucciones:</Label>
              <p className="text-sm text-muted-foreground">
                Copia los datos de tu cliente (WhatsApp, Email) y pégalos abajo.
                El sistema intentará identificar automáticamente los campos.
              </p>
            </div>
            <Textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`Cliente: [Nombre del Cliente]
      Vendedor: [Nombre Vendedor]
      Costo: 100
      Contacto: email @cliente.com
...`}
              className="min-h-[200px] font-mono text-sm"
            />
            <Button onClick={processText} className="w-full">
              Procesar y Verificar
            </Button>
          </TabsContent>

          <TabsContent value="excel" className="space-y-4 h-full flex flex-col">
            <div className="space-y-2">
              <Label>Etapa Inicial para los Leads</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map(stage => (
                    <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {importStatus === 'idle' && (
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg p-10 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="bg-primary/10 p-4 rounded-full mb-4">
                  <Upload size={32} className="text-primary" />
                </div>
                <p className="text-lg font-medium">Click para seleccionar archivo</p>
                <p className="text-sm text-muted-foreground mt-1">Soporta .xlsx, .xls, .pdf</p>
                <p className="text-xs text-muted-foreground mt-4 text-center">
                  Columnas: Nombre, Teléfono, Correo, Empresa
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".xlsx, .xls, .pdf"
                  onChange={handleFileChange}
                />
              </div>
            )}

            {(importStatus === 'preview' || importStatus === 'importing' || importStatus === 'success') && (
              <div className="space-y-4 flex-1 flex flex-col min-h-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate max-w-[120px] sm:max-w-[150px]">{file?.name}</span>
                    <Badge variant="secondary">{previewData.length} contactos</Badge>
                    <Badge variant="outline" className="text-xs text-muted-foreground sm:hidden">
                      ← Desliza →
                    </Badge>
                  </div>
                  {importStatus === 'preview' && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleAddRow}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Plus className="sm:mr-1" size={14} />
                        <span className="hidden sm:inline">Añadir Fila</span>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => {
                        setFile(null)
                        setPreviewData([])
                        setImportStatus('idle')
                      }}>
                        <FileX className="sm:mr-1" size={14} />
                        <span className="hidden sm:inline">Cancelar</span>
                      </Button>
                    </div>
                  )}
                </div>

                {/* Mobile hint */}
                <p className="text-xs text-muted-foreground sm:hidden text-center italic">
                  Desliza horizontalmente para ver todas las columnas
                </p>

                <ScrollArea className="h-[250px] sm:h-[400px] border rounded-md w-full">
                  <div className="overflow-x-auto">
                    <Table className="min-w-[800px]">
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[60px] text-center">Estado</TableHead>
                          <TableHead className="min-w-[150px]">Nombre</TableHead>
                          <TableHead className="min-w-[120px]">Teléfono</TableHead>
                          <TableHead className="min-w-[180px]">Correo</TableHead>
                          <TableHead className="min-w-[150px]">Empresa</TableHead>
                          <TableHead className="min-w-[120px]">Ubicación</TableHead>
                          <TableHead className="w-[100px]">Presupuesto</TableHead>
                          <TableHead className="w-[60px] text-center">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.slice(0, 100).map((row, i) => (
                          <TableRow key={i} className="hover:bg-muted/30">
                            <TableCell className="text-center">
                              {row.isValid ? (
                                <Check size={18} className="text-green-500 mx-auto" />
                              ) : (
                                <span title={row.error} className="cursor-help">
                                  <Warning size={18} className="text-amber-500 mx-auto" />
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="p-1">
                              <Input
                                value={row.nombre_completo || ''}
                                onChange={(e) => handleCellEdit(i, 'nombre_completo', e.target.value)}
                                className="h-8 text-xs bg-blue-50/50 border-blue-200 focus:bg-white min-w-[120px]"
                                placeholder="Nombre"
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input
                                value={row.telefono || ''}
                                onChange={(e) => handleCellEdit(i, 'telefono', e.target.value)}
                                className="h-7 text-xs bg-blue-50/50 border-blue-200 focus:bg-white min-w-[100px]"
                                placeholder="Teléfono"
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input
                                value={row.correo_electronico || ''}
                                onChange={(e) => handleCellEdit(i, 'correo_electronico', e.target.value)}
                                className="h-8 text-xs bg-blue-50/50 border-blue-200 focus:bg-white min-w-[120px]"
                                placeholder="Email"
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input
                                value={row.empresa || ''}
                                onChange={(e) => handleCellEdit(i, 'empresa', e.target.value)}
                                className="h-7 text-xs bg-blue-50/50 border-blue-200 focus:bg-white min-w-[100px]"
                                placeholder="Empresa"
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input
                                value={row.ubicacion || ''}
                                onChange={(e) => handleCellEdit(i, 'ubicacion', e.target.value)}
                                className="h-7 text-xs bg-blue-50/50 border-blue-200 focus:bg-white min-w-[80px]"
                                placeholder="Ubicación"
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input
                                type="number"
                                min="0"
                                value={row.presupuesto || 0}
                                onChange={(e) => handleCellEdit(i, 'presupuesto', Math.max(0, Number(e.target.value)))}
                                className="h-8 text-xs bg-blue-50/50 border-blue-200 focus:bg-white w-[80px]"
                                placeholder="0"
                              />
                            </TableCell>
                            <TableCell className="p-1 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-500 hover:text-white hover:bg-red-500 rounded-full"
                                onClick={() => handleDeleteRow(i)}
                                title="Eliminar fila"
                              >
                                <Trash size={16} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {previewData.length > 100 && (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground text-xs">
                              ... y {previewData.length - 100} más
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>

                <div className="pt-2">
                  {importStatus === 'preview' && (
                    <Button onClick={handleImport} className="w-full" disabled={previewData.filter(r => r.isValid).length === 0}>
                      Importar {previewData.filter(r => r.isValid).length} Leads
                    </Button>
                  )}
                  {importStatus === 'importing' && (
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <Progress value={progress} className="h-2" />
                        <p className="text-xs text-center text-muted-foreground">Procesando... {progress}%</p>
                      </div>
                      <Button disabled className="w-full">
                        <Spinner className="mr-2 animate-spin" />
                        Importando...
                      </Button>
                    </div>
                  )}
                  {importStatus === 'success' && (
                    <Button variant="default" className="w-full bg-green-600 hover:bg-green-700">
                      <Check className="mr-2" />
                      Listo
                    </Button>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
