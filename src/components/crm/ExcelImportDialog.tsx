
import { useRef, useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Upload, Check, Warning, Spinner } from '@phosphor-icons/react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { createLead } from '@/supabase/services/leads'

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

const isDateLike = (str: any) => {
    if (str == null) return false
    const s = String(str).trim()
    const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/)
    if (!m) return false
    const d = Number(m[1]); const mo = Number(m[2]); const yy = m[3]
    const y = yy.length === 2 ? 2000 + Number(yy) : Number(yy)
    if (Number.isNaN(d) || Number.isNaN(mo) || Number.isNaN(y)) return false
    return true
}

const isDateValue = (val: any) => {
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

export function ExcelImportDialog({
    pipelineId,
    defaultStageId,
    companyId,
    currentUserId,
    trigger,
    onSuccess
}: ExcelImportDialogProps) {
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

            const mappedData: PreviewRow[] = jsonData.map(row => {
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

                const isValid = !!nombre

                return {
                    nombre_completo: nombre,
                    telefono: String(telefono),
                    correo_electronico: correo,
                    empresa,
                    presupuesto: Number(presupuesto) || 0,
                    notas,
                    isValid,
                    error: !isValid ? 'Nombre es requerido' : undefined
                }
            })

            setPreviewData(mappedData)
        } catch (err) {
            console.error('Error parsing Excel', err)
            toast.error('Error al leer el archivo Excel')
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
                    empresa: row.empresa,
                    presupuesto: row.presupuesto,
                    empresa_id: companyId,
                    pipeline_id: pipelineId,
                    etapa_id: defaultStageId,
                    creado_por: currentUserId,
                    asignado_a: null,
                    prioridad: 'medium',
                    origen: 'import_excel'
                })
                successCount++
            } catch (err) {
                console.error('Error importing row', row, err)
                errorsCount++
            }
        }

        setIsProcessing(false)
        setStatus('success')
        toast.success(`Importación finalizada: ${successCount} leads creados. ${errorsCount > 0 ? `${errorsCount} errores.` : ''}`)

        if (onSuccess) onSuccess()

        setTimeout(() => {
            setIsOpen(false)
            setFile(null)
            setPreviewData([])
            setStatus('idle')
        }, 1200)
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
            <DialogContent className="max-w-3xl w-full max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Importar Leads desde Excel</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Archivo</Label>
                        <div className="flex items-center gap-3">
                            <Input
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isProcessing}
                            >
                                <Upload size={16} className="mr-2" />
                                Seleccionar archivo
                            </Button>
                            <span className="text-sm text-muted-foreground truncate">
                                {file ? file.name : 'Ningún archivo seleccionado'}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Columnas esperadas: Nombre, Teléfono, Correo, Empresa (presupuesto y notas opcionales)
                        </p>
                    </div>

                    {status === 'preview' && previewData.length === 0 && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Spinner className="animate-spin" size={16} />
                            Procesando archivo...
                        </div>
                    )}

                    {previewData.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                    <Check className="text-green-600" size={16} />
                                    <span>{previewData.filter(r => r.isValid).length} filas válidas</span>
                                </div>
                                {previewData.some(r => !r.isValid) && (
                                    <div className="flex items-center gap-2 text-amber-600">
                                        <Warning size={16} />
                                        <span>{previewData.filter(r => !r.isValid).length} filas con errores</span>
                                    </div>
                                )}
                            </div>

                            <ScrollArea className="h-72 border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Estado</TableHead>
                                            <TableHead>Nombre</TableHead>
                                            <TableHead>Teléfono</TableHead>
                                            <TableHead>Correo</TableHead>
                                            <TableHead>Empresa</TableHead>
                                            <TableHead>Presupuesto</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {previewData.slice(0, 200).map((row, i) => (
                                            <TableRow key={i}>
                                                <TableCell>
                                                    {row.isValid ? (
                                                        <span className="inline-flex items-center gap-1 text-xs text-green-600">
                                                            <Check size={14} /> OK
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                                                            <Warning size={14} /> {row.error || 'Revisar'}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell>{row.nombre_completo}</TableCell>
                                                <TableCell>{row.telefono}</TableCell>
                                                <TableCell className="break-all">{row.correo_electronico}</TableCell>
                                                <TableCell>{row.empresa}</TableCell>
                                                <TableCell>{row.presupuesto}</TableCell>
                                            </TableRow>
                                        ))}
                                        {previewData.length > 200 && (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center text-muted-foreground">
                                                    Mostrando 200 de {previewData.length} filas
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="flex items-center gap-2 text-green-700 text-sm">
                            <Check size={18} /> Importación completada
                        </div>
                    )}

                    {previewData.length === 0 && status === 'idle' && (
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg p-10 cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className="bg-primary/10 p-4 rounded-full mb-4">
                                <Upload size={32} className="text-primary" />
                            </div>
                            <p className="text-lg font-medium">Click para seleccionar archivo</p>
                            <p className="text-sm text-muted-foreground mt-1">Soporta .xlsx, .xls, .csv</p>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={isProcessing}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleImport}
                        disabled={isProcessing || previewData.filter(r => r.isValid).length === 0}
                    >
                        {isProcessing ? (
                            <span className="inline-flex items-center gap-2">
                                <Spinner className="animate-spin" size={16} /> Importando...
                            </span>
                        ) : (
                            'Importar'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
