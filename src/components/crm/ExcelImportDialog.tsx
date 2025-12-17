
import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FileX, Upload, Check, Warning, Spinner } from '@phosphor-icons/react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { createLead } from '@/supabase/services/leads'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ExcelImportDialogProps {
    pipelineType: string
    pipelineId?: string
    defaultStageId?: string
    companyId: string
    currentUserId: string
    trigger?: React.ReactNode
    onSuccess?: () => void
}

interface PreviewRow {
    nombre_completo?: string
    telefono?: string
    correo_electronico?: string
    empresa?: string
    presupuesto?: number
    notas?: string
    isValid: boolean
    error?: string
}

export function ExcelImportDialog({
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Teléfono</TableHead>
                                    <TableHead>Correo</TableHead>
                                    <TableHead>Empresa</TableHead>
                                    <TableHead>Presupuesto</TableHead>
    currentUserId,
    trigger,
    onSuccess
                                {previewData.slice(0, 100).map((row, i) => (
    const isDateLike = (str: any) => {
        if (str == null) return false
        const s = String(str).trim()
        const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/)
        if (!m) return false
        const d = Number(m[1]); const mo = Number(m[2]); const yy = m[3]
        const y = yy.length === 2 ? 2000 + Number(yy) : Number(yy)
        if (Number.isNaN(d) || Number.isNaN(mo) || Number.isNaN(y)) return false
                                        <TableCell>{row.nombre_completo}</TableCell>
                                        <TableCell>{row.telefono}</TableCell>
                                        <TableCell>{row.correo_electronico}</TableCell>
                                        <TableCell>{row.empresa}</TableCell>
                                        <TableCell>{row.presupuesto}</TableCell>
        return true
    }
                                {previewData.length > 100 && (
    const isDateValue = (val: any) => {
                                        <TableCell colSpan={7} className="text-center text-muted-foreground">
        if (val instanceof Date) return true
        if (typeof val === 'number') return val > 20000 && val < 90000
        return isDateLike(String(val))
    }

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

    const stripLeadingDayToken = (val: any) => {
        if (val == null) return ''
        const s = String(val).trim()
        if (!s) return ''
        return s.replace(/^\d{1,2}\s+/, '').trim()
    }

    const cleanNameValue = (val: any) => stripLeadingDayToken(stripLeadingDate(val))
    const [isOpen, setIsOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [previewData, setPreviewData] = useState<PreviewRow[]>([])
    const [isProcessing, setIsProcessing] = useState(false)
    const [status, setStatus] = useState<'idle' | 'preview' | 'importing' | 'success'>('idle')
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (!selectedFile) return

        setFile(selectedFile)
        setStatus('preview')

        try {
            const data = await selectedFile.arrayBuffer()
            const workbook = XLSX.read(data)
            const worksheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[worksheetName]
            const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]

            // Map columns and validate
            const mappedData: PreviewRow[] = jsonData.map(row => {
                // Normalize keys to lowercase for flexible matching
                const normalizedRow = Object.keys(row).reduce((acc: any, key) => {
                    acc[key.toLowerCase().trim()] = row[key]
                    return acc
                }, {})

                const nombreRaw = normalizedRow['nombre'] || normalizedRow['name'] || normalizedRow['nombre completo'] || ''
                const telefonoRaw = normalizedRow['telefono'] || normalizedRow['teléfono'] || normalizedRow['phone'] || normalizedRow['celular'] || ''
                const correoRaw = normalizedRow['correo'] || normalizedRow['email'] || normalizedRow['e-mail'] || normalizedRow['correo electronico'] || ''
                const empresaRaw = normalizedRow['empresa'] || normalizedRow['company'] || normalizedRow['compañia'] || ''
                const presupuesto = normalizedRow['presupuesto'] || normalizedRow['budget'] || 0
                const notas = normalizedRow['notas'] || normalizedRow['notes'] || ''

                const nombre = isDateValue(nombreRaw) ? '' : cleanNameValue(nombreRaw)
                const telefono = isDateValue(telefonoRaw) ? '' : stripLeadingDate(String(telefonoRaw))
                const correo = isDateValue(correoRaw) ? '' : stripLeadingDate(correoRaw)
                const empresa = isDateValue(empresaRaw) ? '' : stripLeadingDate(empresaRaw)

                const isValid = !!nombre // Name is required minimally

                return {
                    nombre_completo: nombre,
                    telefono: String(telefono),
                    correo_electronico: correo,
                    empresa: empresa,
                    presupuesto: Number(presupuesto) || 0,
                    notas: notas,
                    isValid,
                    error: !isValid ? 'Nombre es requerido' : undefined
                }
            })

            setPreviewData(mappedData)
        } catch (err) {
            console.error("Error parsing Excel", err)
            toast.error("Error al leer el archivo Excel")
            setStatus('idle')
            setFile(null)
        }
    }

    const handleImport = async () => {
        if (!companyId || !defaultStageId) {
            toast.error('Faltan datos de configuración (Compañía o Etapa)')
            return
        }

        setIsProcessing(true)
        setStatus('importing')

        let successCount = 0
        let errorsCount = 0

        const validRows = previewData.filter(r => r.isValid)

        for (const row of validRows) {
            try {
                await createLead({
                    nombre_completo: row.nombre_completo,
                    telefono: row.telefono,
                    correo_electronico: row.correo_electronico,
                    empresa: row.empresa, // Text name of the lead's company
                    presupuesto: row.presupuesto,
                    // System fields
                    empresa_id: companyId, // The tenant ID
                    pipeline_id: pipelineId,
                    etapa_id: defaultStageId,
                    creado_por: currentUserId,
                    asignado_a: null, // Unassigned by default
                    prioridad: 'medium',
                    origen: 'import_excel'
                })
                successCount++
            } catch (err) {
                console.error('Error importing row', row, err)
                errorsCount++
                // Continue with next row
            }
        }

        setIsProcessing(false)
        setStatus('success')
        toast.success(`Importación finalizada: ${successCount} leads creados. ${errorsCount > 0 ? `${errorsCount} errores.` : ''}`)

        if (onSuccess) onSuccess()

        setTimeout(() => {
            setIsOpen(false)
            // Reset state
            setFile(null)
            setPreviewData([])
            setStatus('idle')
        }, 2000)
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm">
                        <Upload className="mr-2" size={20} />
                        Importar Excel
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Importar Leads desde Excel</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-4 py-4">
                    {status === 'idle' && (
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg p-10 cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className="bg-primary/10 p-4 rounded-full mb-4">
                                <Upload size={32} className="text-primary" />
                            </div>
                            <p className="text-lg font-medium">Click para seleccionar archivo</p>
                            <p className="text-sm text-muted-foreground mt-1">Soporta .xlsx, .xls</p>
                            <p className="text-xs text-muted-foreground mt-4 text-center">
                                Columnas esperadas: Nombre, Teléfono, Correo, Empresa
                            </p>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept=".xlsx, .xls"
                                onChange={handleFileChange}
                            />
                        </div>
                    )}

                    {(status === 'preview' || status === 'importing' || status === 'success') && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold">{file?.name}</span>
                                    <Badge variant="secondary">{previewData.length} filas</Badge>
                                </div>
                                {status === 'preview' && (
                                    <Button variant="ghost" size="sm" onClick={() => {
                                        setFile(null)
                                        setPreviewData([])
                                        setStatus('idle')
                                    }}>
                                        <FileX className="mr-2" />
                                        Cancelar
                                    </Button>
                                )}
                            </div>

                            <ScrollArea className="h-[300px] border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Estado</TableHead>
                                            <TableHead>Nombre</TableHead>
                                            <TableHead>Teléfono</TableHead>
                                            <TableHead>Correo</TableHead>
                                            <TableHead>Empresa</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {previewData.slice(0, 100).map((row, i) => (
                                            <TableRow key={i}>
                                                <TableCell>
                                                    {row.isValid ? (
                                                        <Check size={16} className="text-green-500" />
                                                    ) : (
                                                        <Warning size={16} className="text-amber-500" title={row.error} />
                                                    )}
                                                </TableCell>
                                                <TableCell>{row.nombre_completo}</TableCell>
                                                <TableCell>{row.telefono}</TableCell>
                                                <TableCell>{row.correo_electronico}</TableCell>
                                                <TableCell>{row.empresa}</TableCell>
                                            </TableRow>
                                        ))}
                                        {previewData.length > 100 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center text-muted-foreground">
                                                    ... y {previewData.length - 100} más
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {status === 'preview' && (
                        <Button onClick={handleImport} disabled={previewData.filter(r => r.isValid).length === 0}>
                            Importar {previewData.filter(r => r.isValid).length} Leads
                        </Button>
                    )}
                    {status === 'importing' && (
                        <Button disabled>
                            <Spinner className="mr-2 animate-spin" />
                            Importando...
                        </Button>
                    )}
                    {status === 'success' && (
                        <Button variant="default" className="bg-green-600 hover:bg-green-700">
                            <Check className="mr-2" />
                            Listo
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
