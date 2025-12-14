import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Copy, CaretDown, CaretRight } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { supabase } from '@/supabase/client'

interface Pipeline {
    id: string
    nombre: string
    created_at: string
}

interface Etapa {
    id: string
    nombre: string
    orden: number
    color: string
    pipeline_id: string
}

interface IDsViewerProps {
    empresaId?: string
    empresaNombre?: string
}

export function IDsViewer({ empresaId, empresaNombre }: IDsViewerProps) {
    const [pipelines, setPipelines] = useState<Pipeline[]>([])
    const [etapas, setEtapas] = useState<Etapa[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedPipelines, setExpandedPipelines] = useState<Set<string>>(new Set())

    useEffect(() => {
        if (!empresaId) return

        const fetchData = async () => {
            setLoading(true)
            try {
                // Obtener pipelines de la empresa
                const { data: pipelinesData, error: pipelinesError } = await supabase
                    .from('pipeline')
                    .select('id, nombre, created_at')
                    .eq('empresa_id', empresaId)
                    .order('created_at', { ascending: true })

                console.log('[IDsViewer] Pipelines encontrados:', pipelinesData?.length || 0)
                if (pipelinesError) console.error('[IDsViewer] Error pipelines:', pipelinesError)

                setPipelines(pipelinesData || [])

                // Obtener todas las etapas de todos los pipelines
                if (pipelinesData && pipelinesData.length > 0) {
                    const pipelineIds = pipelinesData.map(p => p.id)
                    console.log('[IDsViewer] Buscando etapas para pipelines:', pipelineIds)

                    // La tabla en Supabase se llama 'etapas' (plural)
                    const { data: etapasData, error: etapasError } = await supabase
                        .from('etapas')
                        .select('id, nombre, orden, color, pipeline_id')
                        .in('pipeline_id', pipelineIds)
                        .order('orden', { ascending: true, nullsFirst: false })

                    console.log('[IDsViewer] Etapas encontradas:', etapasData?.length || 0)
                    if (etapasError) console.error('[IDsViewer] Error etapas:', etapasError)

                    setEtapas(etapasData || [])
                }
            } catch (error) {
                console.error('[IDsViewer] Error fetching IDs:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [empresaId])

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text)
        toast.success(`${label} copiado al portapapeles`)
    }

    const togglePipeline = (pipelineId: string) => {
        setExpandedPipelines(prev => {
            const next = new Set(prev)
            if (next.has(pipelineId)) {
                next.delete(pipelineId)
            } else {
                next.add(pipelineId)
            }
            return next
        })
    }

    const getEtapasForPipeline = (pipelineId: string) => {
        return etapas.filter(e => e.pipeline_id === pipelineId)
    }

    if (!empresaId) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                Selecciona una empresa para ver los IDs
            </div>
        )
    }

    if (loading) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                Cargando IDs...
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">
                    Estos IDs son necesarios para configurar las variables de entorno del webhook:
                </p>
                <code className="text-xs bg-background p-2 rounded block">
                    DEFAULT_EMPRESA_ID, DEFAULT_PIPELINE_ID, DEFAULT_ETAPA_ID
                </code>
            </div>

            {/* Empresa ID */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center justify-between">
                        <span>🏢 Empresa</span>
                        <Badge variant="outline">{empresaNombre || 'Empresa Actual'}</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">DEFAULT_EMPRESA_ID</p>
                            <code className="text-sm font-mono">{empresaId}</code>
                        </div>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(empresaId, 'ID de Empresa')}
                        >
                            <Copy size={16} />
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Pipelines */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">📊 Pipelines ({pipelines.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {pipelines.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">No hay pipelines en esta empresa</p>
                    ) : (
                        pipelines.map((pipeline) => (
                            <div key={pipeline.id} className="border border-border rounded-lg overflow-hidden">
                                <div
                                    className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                                    onClick={() => togglePipeline(pipeline.id)}
                                >
                                    <div className="flex items-center gap-2">
                                        {expandedPipelines.has(pipeline.id) ? (
                                            <CaretDown size={16} />
                                        ) : (
                                            <CaretRight size={16} />
                                        )}
                                        <span className="font-medium">{pipeline.nombre}</span>
                                        <Badge variant="secondary" className="text-xs">
                                            {getEtapasForPipeline(pipeline.id).length} etapas
                                        </Badge>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            copyToClipboard(pipeline.id, 'ID de Pipeline')
                                        }}
                                    >
                                        <Copy size={16} />
                                    </Button>
                                </div>

                                <div className="px-3 py-2 bg-background">
                                    <p className="text-xs text-muted-foreground mb-1">DEFAULT_PIPELINE_ID</p>
                                    <code className="text-xs font-mono">{pipeline.id}</code>
                                </div>

                                {/* Etapas del pipeline */}
                                {expandedPipelines.has(pipeline.id) && (
                                    <div className="border-t border-border">
                                        <div className="p-3 bg-background">
                                            <p className="text-xs font-medium text-muted-foreground mb-2">Etapas:</p>
                                            <div className="space-y-2">
                                                {getEtapasForPipeline(pipeline.id).map((etapa) => (
                                                    <div
                                                        key={etapa.id}
                                                        className="flex items-center justify-between p-2 bg-muted/30 rounded"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div
                                                                className="w-3 h-3 rounded-full"
                                                                style={{ backgroundColor: etapa.color || '#3b82f6' }}
                                                            />
                                                            <span className="text-sm">{etapa.nombre}</span>
                                                            <Badge variant="outline" className="text-xs">
                                                                orden: {etapa.orden}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <code className="text-xs font-mono bg-background px-2 py-1 rounded">
                                                                {etapa.id.slice(0, 8)}...
                                                            </code>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => copyToClipboard(etapa.id, `ID de Etapa "${etapa.nombre}"`)}
                                                            >
                                                                <Copy size={14} />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                                {getEtapasForPipeline(pipeline.id).length === 0 && (
                                                    <p className="text-center text-muted-foreground text-sm py-2">
                                                        No hay etapas en este pipeline
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
