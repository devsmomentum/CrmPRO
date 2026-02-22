/**
 * useExcelImport - Hook for parsing Excel files and importing leads
 * 
 * Extracted from AddLeadDialog.tsx for better separation of concerns.
 * Handles: Excel parsing, header detection, phone normalization, 
 * budget parsing, and deduplication against existing leads.
 */

import { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

// ============================================================================
// Types
// ============================================================================

export interface PreviewRow {
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

export type ImportStatus = 'idle' | 'preview' | 'importing' | 'success'

interface UseExcelImportOptions {
    companyId?: string
}

interface UseExcelImportReturn {
    previewData: PreviewRow[]
    setPreviewData: React.Dispatch<React.SetStateAction<PreviewRow[]>>
    importStatus: ImportStatus
    setImportStatus: React.Dispatch<React.SetStateAction<ImportStatus>>
    progress: number
    setProgress: React.Dispatch<React.SetStateAction<number>>
    parseExcel: (file: File) => Promise<void>
    handleCellEdit: (index: number, field: keyof PreviewRow, value: any) => void
    handleDeleteRow: (index: number) => void
    handleAddRow: () => void
    resetImport: () => void
}

// ============================================================================
// Helper Functions (Date detection & cleaning)
// ============================================================================

/**
 * Detects date-like strings (DD/MM/YYYY or DD-MM-YYYY)
 */
const isDateLike = (str: string): boolean => {
    if (!str) return false
    const s = String(str).trim()
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2}|\d{4})$/)
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

/**
 * Detects date values from Excel (string, Date object, or serial number)
 */
const isDateValue = (val: any): boolean => {
    if (val == null) return false
    if (val instanceof Date) return true
    if (typeof val === 'number') {
        // Excel serial date ranges (approximate)
        return val > 20000 && val < 90000
    }
    return isDateLike(String(val))
}

/**
 * Strips leading date from a value (e.g., "23/12/2025 John" -> "John")
 */
const stripLeadingDate = (val: any): string => {
    if (val == null) return ''
    if (val instanceof Date) return ''
    const s = String(val).trim()
    if (!s) return ''
    const m = s.match(/^(\d{1,2}[\/\-]\d{1,2}[\/\-](\d{2}|\d{4}))\s*[,:;\-]*\s*(.+)$/)
    if (m) {
        return m[3].trim()
    }
    return s
}

/**
 * Strips leading day token (e.g., "25 Carlos" -> "Carlos")
 */
const stripLeadingDayToken = (val: any): string => {
    if (val == null) return ''
    const s = String(val).trim()
    if (!s) return ''
    return s.replace(/^\d{1,2}\s+/, '').trim()
}

/**
 * Cleans a name value by stripping dates and day tokens
 */
const cleanNameValue = (val: any): string => stripLeadingDayToken(stripLeadingDate(val))

/**
 * Normalizes phone numbers to Venezuelan format
 */
const normalizePhone = (phone: string | number): string => {
    let p = String(phone).replace(/\D/g, '')
    if (p.startsWith('0')) {
        p = '58' + p.substring(1)
    } else if (p.length === 10 && (p.startsWith('4') || p.startsWith('2'))) {
        p = '58' + p
    }
    return p
}

/**
 * Parses budget values handling various formats (US, European, currency symbols)
 */
const parsePresupuesto = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0
    if (typeof val === 'number') return val

    let str = String(val).trim()
    str = str.replace(/[^\d.,\-]/g, '')
    if (!str) return 0

    const hasCommaAsDecimal = /\d,\d{1,2}$/.test(str)
    const hasDotAsDecimal = /\d\.\d{1,2}$/.test(str)

    if (hasCommaAsDecimal && !hasDotAsDecimal) {
        str = str.replace(/\./g, '').replace(',', '.')
    } else {
        str = str.replace(/,/g, '')
    }

    const num = parseFloat(str)
    return Number.isNaN(num) ? 0 : Math.abs(num)
}

// ============================================================================
// Main Hook
// ============================================================================

export function useExcelImport(options: UseExcelImportOptions = {}): UseExcelImportReturn {
    const { companyId } = options

    const [previewData, setPreviewData] = useState<PreviewRow[]>([])
    const [importStatus, setImportStatus] = useState<ImportStatus>('idle')
    const [progress, setProgress] = useState(0)

    /**
     * Parses an Excel file and populates preview data with deduplication
     */
    const parseExcel = useCallback(async (file: File) => {
        const data = await file.arrayBuffer()
        const workbook = XLSX.read(data)
        const worksheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[worksheetName]

        // Convert to array of arrays to find header row
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

        if (rawData.length === 0) {
            throw new Error('El archivo parece estar vacío')
        }

        // Find header row
        const headerKeywords = [
            'nombre', 'nombres', 'name', 'names', 'cliente', 'completo', 'titular', 'contacto',
            'telefono', 'teléfono', 'phone', 'celular', 'cel', 'movil', 'mobile', 'whatsapp', 'wsp', 'tel',
            'correo', 'email', 'e-mail', 'mail', 'direccion', 'dirección', 'empresa', 'company', 'budget', 'presupuesto',
            'ubicacion', 'ubicación', 'location', 'address', 'ciudad', 'city', 'pais', 'country', 'estado', 'provincia', 'municipio', 'sector'
        ]

        let headerRowIndex = 0
        let bestMatchIndex = -1
        let maxMatches = 0

        for (let i = 0; i < Math.min(rawData.length, 25); i++) {
            const rowString = JSON.stringify(rawData[i]).toLowerCase()
            const matches = headerKeywords.filter(k => rowString.includes(k)).length

            if (matches > maxMatches) {
                maxMatches = matches
                bestMatchIndex = i
            }

            if (matches >= 3) {
                bestMatchIndex = i
                break
            }
        }

        if (bestMatchIndex !== -1 && maxMatches >= 1) {
            headerRowIndex = bestMatchIndex
        }

        // Re-read using detected header row
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
        range.s.r = headerRowIndex

        const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: range }) as any[]

        // Map columns and validate
        const mappedData: PreviewRow[] = jsonData.map(row => {
            const normalizedRow = Object.keys(row).reduce((acc: any, key) => {
                acc[key.toLowerCase().trim()] = row[key]
                return acc
            }, {})

            // Pick value helper with used keys tracking
            const pickValue = (keys: string[], used: Set<string>, skipDateCheck = false) => {
                for (const k of keys) {
                    if (used.has(k)) continue
                    if (normalizedRow[k] !== undefined) {
                        const v = normalizedRow[k]
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

            // Fallback for location
            if (!ubicacion) {
                const ubicKey = Object.keys(normalizedRow).find(k =>
                    k.includes('ubic') || k.includes('direcc') || k.includes('lugar') || k.includes('zona')
                )
                if (ubicKey) {
                    ubicacion = stripLeadingDate(normalizedRow[ubicKey])
                    if (empresaPick.key === ubicKey) {
                        empresa = ''
                    }
                }
            }

            // Force empty empresa if no header
            const hasEmpresaHeader = Object.keys(normalizedRow).some(k => empresaKeys.includes(k))
            if (!hasEmpresaHeader) {
                empresa = ''
            }

            // Budget parsing
            const presupuestoKeys = [
                'presupuesto', 'budget', 'monto', 'valor', 'precio', 'costo', 'cost',
                'amount', 'total', 'importe', 'cuota', 'fee', 'tarifa', 'rate',
                'inversion', 'inversión', 'investment', 'pago', 'payment', 'cotizacion',
                'cotización', 'quote', 'estimado', 'estimate', 'price'
            ]
            const rawPresupuesto = pickValue(presupuestoKeys, usedKeys, true).value
            const presupuesto = parsePresupuesto(rawPresupuesto)

            const notas = pickValue(['notas', 'notes', 'comentarios', 'observaciones', 'description'], usedKeys).value
            const telefono = isDateValue(rawTelefono) ? '' : normalizePhone(stripLeadingDate(String(rawTelefono)))

            const isValid = !!nombre

            // Skip empty rows
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

        // Deduplicate
        const seenEmails = new Set<string>()
        const seenPhones = new Set<string>()

        // Fetch existing leads for DB deduplication
        let existingLeadsMaps: { emails: Set<string>, phones: Set<string> } = { emails: new Set(), phones: new Set() }

        if (companyId) {
            try {
                const { data: existingData } = await supabase
                    .from('lead')
                    .select('correo_electronico, telefono')
                    .eq('empresa_id', companyId)

                if (existingData) {
                    existingData.forEach((l: any) => {
                        if (l.correo_electronico) existingLeadsMaps.emails.add(String(l.correo_electronico).toLowerCase().trim())
                        if (l.telefono) existingLeadsMaps.phones.add(String(l.telefono).replace(/\D/g, ''))
                    })
                }
            } catch (err) {
                console.error('Error fetching existing leads for deduplication', err)
            }
        }

        const processedData = mappedData.map(row => {
            const email = row.correo_electronico?.toLowerCase().trim()
            const rawPhone = row.telefono ? String(row.telefono).replace(/\D/g, '') : ''

            if (!row.isValid) return row

            // Check internal duplicates
            if (email && seenEmails.has(email)) {
                return { ...row, isValid: false, error: 'Duplicado en este archivo (Email)' }
            }
            if (rawPhone && rawPhone.length > 6 && seenPhones.has(rawPhone)) {
                return { ...row, isValid: false, error: 'Duplicado en este archivo (Teléfono)' }
            }

            // Check DB duplicates
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
    }, [companyId])

    /**
     * Edits a cell in the preview table
     */
    const handleCellEdit = useCallback((index: number, field: keyof PreviewRow, value: any) => {
        setPreviewData(prev => {
            const updated = [...prev]
            updated[index] = { ...updated[index], [field]: value }

            // Re-validate
            const row = updated[index]
            const isValid = !!row.nombre_completo?.trim()
            updated[index].isValid = isValid
            updated[index].error = !isValid ? 'Nombre es requerido' : undefined

            return updated
        })
    }, [])

    /**
     * Deletes a row from preview
     */
    const handleDeleteRow = useCallback((index: number) => {
        setPreviewData(prev => prev.filter((_, i) => i !== index))
    }, [])

    /**
     * Adds an empty row to preview
     */
    const handleAddRow = useCallback(() => {
        setPreviewData(prev => [...prev, {
            nombre_completo: '',
            telefono: '',
            correo_electronico: '',
            empresa: '',
            ubicacion: '',
            presupuesto: 0,
            notas: '',
            isValid: false,
            error: 'Nombre es requerido'
        }])
    }, [])

    /**
     * Resets import state
     */
    const resetImport = useCallback(() => {
        setPreviewData([])
        setImportStatus('idle')
        setProgress(0)
    }, [])

    return {
        previewData,
        setPreviewData,
        importStatus,
        setImportStatus,
        progress,
        setProgress,
        parseExcel,
        handleCellEdit,
        handleDeleteRow,
        handleAddRow,
        resetImport
    }
}
