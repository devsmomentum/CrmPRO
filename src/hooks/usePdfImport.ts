/**
 * usePdfImport - Hook for parsing PDF files containing lead data
 * 
 * Extracted from AddLeadDialog.tsx for better separation of concerns.
 * Handles: PDF loading, text extraction by coordinates, row reconstruction,
 * and field detection (name, phone, email, company, location, budget).
 */

import { useState, useCallback } from 'react'
import type { PreviewRow } from './useExcelImport'

// ============================================================================
// PDF.js Lazy Loading
// ============================================================================

let pdfjsLib: any = null

const loadPdfJs = async () => {
    if (!pdfjsLib) {
        pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
            'pdfjs-dist/build/pdf.worker.min.mjs',
            import.meta.url
        ).toString()
    }
    return pdfjsLib
}

// ============================================================================
// Helper Functions
// ============================================================================

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

const isDateValue = (val: any): boolean => {
    if (val == null) return false
    if (val instanceof Date) return true
    if (typeof val === 'number') {
        return val > 20000 && val < 90000
    }
    return isDateLike(String(val))
}

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

const stripLeadingDayToken = (val: any): string => {
    if (val == null) return ''
    const s = String(val).trim()
    if (!s) return ''
    return s.replace(/^\d{1,2}\s+/, '').trim()
}

const cleanNameValue = (val: any): string => stripLeadingDayToken(stripLeadingDate(val))

// ============================================================================
// Types
// ============================================================================

interface UsePdfImportReturn {
    parsePDF: (file: File) => Promise<PreviewRow[]>
    isLoading: boolean
    error: string | null
}

// ============================================================================
// Main Hook
// ============================================================================

export function usePdfImport(): UsePdfImportReturn {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    /**
     * Parses a PDF file and extracts lead data
     */
    const parsePDF = useCallback(async (file: File): Promise<PreviewRow[]> => {
        setIsLoading(true)
        setError(null)

        try {
            const pdfjs = await loadPdfJs()
            const arrayBuffer = await file.arrayBuffer()
            const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise

            let allLines: string[] = []

            // Extract text from all pages
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum)
                const textContent = await page.getTextContent()

                // Group items by Y coordinate (row) with tolerance
                const rows: { [key: number]: string[] } = {}

                textContent.items.forEach((item: any) => {
                    const y = Math.round(item.transform[5] / 5) * 5
                    if (!rows[y]) rows[y] = []
                    rows[y].push(item.str)
                })

                // Sort rows by Y (descending - PDF Y starts at bottom)
                const sortedY = Object.keys(rows).map(Number).sort((a, b) => b - a)
                const pageLines = sortedY.map(y => rows[y].join('  '))
                allLines = [...allLines, ...pageLines]
            }

            const mappedData: PreviewRow[] = []
            const lines = allLines.filter(l => l.trim())

            let hasEmpresaHeader = false
            let hasUbicacionHeader = false
            let headerDetected = false

            for (const line of lines) {
                const trimmed = line.trim()

                if (trimmed.length < 5) continue

                // Detect header
                if (!headerDetected && /^(nombre|name|telefono|phone|email|correo|fecha|date|empresa|company|ubicacion|location|direccion|lugar)/i.test(trimmed)) {
                    if (/empresa|company|negocio/i.test(trimmed)) hasEmpresaHeader = true
                    if (/ubicacion|location|direccion|ciudad|pais|lugar|zona/i.test(trimmed)) hasUbicacionHeader = true
                    headerDetected = true
                    continue
                }

                if (/^(nombre|name|telefono|phone|email|correo|fecha|date)/i.test(trimmed)) continue

                // Try multiple splitting strategies
                let parts: string[] = trimmed.split(/\s{2,}/)

                if (parts.length < 2) {
                    parts = trimmed.split(/\t+/)
                }

                if (parts.length < 2 && trimmed.includes('  ')) {
                    parts = trimmed.split(/\s+/)
                }

                if (parts.length < 2) continue

                // Clean parts
                const cleanedParts = parts
                    .map(p => stripLeadingDate(p))
                    .filter(p => p && !isDateValue(p))

                let nombre = ''
                let telefono = ''
                let correo = ''
                let empresa = ''
                let ubicacion = ''
                let presupuesto = 0
                const textParts: string[] = []

                for (const part of cleanedParts) {
                    const p = part.trim()
                    if (!p) continue

                    // Email detection
                    if (p.includes('@') && p.includes('.') && p.length > 5) {
                        correo = p
                    }
                    // Phone detection
                    else if (/\d{7,}/.test(p) || /[\+\(\)\-\s\d]{10,}/.test(p)) {
                        if (!/^\d{4}$/.test(p) && !/^\d{1,2}$/.test(p)) {
                            let cleanPhone = p.replace(/\D/g, '')
                            if (cleanPhone.startsWith('0')) {
                                cleanPhone = '58' + cleanPhone.substring(1)
                            } else if (cleanPhone.length === 10 && (cleanPhone.startsWith('4') || cleanPhone.startsWith('2'))) {
                                cleanPhone = '58' + cleanPhone
                            }
                            telefono = cleanPhone
                        }
                    }
                    // Budget detection
                    else if (/\$/.test(p) || /^(?:\d{1,3}(?:[\.,]\d{3})+|\d+)(?:[\.,]\d+)?$/.test(p)) {
                        const num = p.replace(/[^0-9.]/g, '')
                        const parsed = parseFloat(num)
                        if (!Number.isNaN(parsed)) {
                            presupuesto = parsed
                        }
                    }
                    // Text parts (name/company)
                    else if (/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(p) && p.length > 2) {
                        if (!/^(date|fecha|nombre|name|phone|telefono|email|correo)$/i.test(p)) {
                            textParts.push(p)
                        }
                    }
                }

                // Assign name and company from text parts
                if (textParts.length > 0) {
                    nombre = cleanNameValue(textParts[0]).trim()
                    if (textParts.length > 1) {
                        const secondPart = stripLeadingDate(textParts[1]).trim()

                        if (hasUbicacionHeader && !hasEmpresaHeader) {
                            ubicacion = secondPart
                        } else if (hasEmpresaHeader && !hasUbicacionHeader) {
                            empresa = secondPart
                        } else {
                            empresa = secondPart
                            if (textParts.length > 2) {
                                ubicacion = stripLeadingDate(textParts[2]).trim()
                            }
                        }
                    }
                }

                nombre = nombre.substring(0, 100)

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

            setIsLoading(false)
            return mappedData
        } catch (err: any) {
            setError(err.message || 'Error parsing PDF')
            setIsLoading(false)
            throw err
        }
    }, [])

    return {
        parsePDF,
        isLoading,
        error
    }
}
