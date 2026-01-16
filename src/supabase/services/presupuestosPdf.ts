import { supabase } from '../client'

const BUCKET_NAME = 'Presupuestos'

export interface PresupuestoPdf {
    id: string
    lead_id: string
    nombre: string
    url: string
    created_at: string
    creado_por: string | null
}

/**
 * Obtener todos los presupuestos PDF de un lead
 */
export async function getPresupuestosByLead(leadId: string): Promise<PresupuestoPdf[]> {
    const { data, error } = await supabase
        .from('presupuesto_pdf')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
}

/**
 * Subir un PDF de presupuesto para un lead
 */
export async function uploadPresupuestoPdf(
    leadId: string,
    file: File,
    nombre: string
): Promise<PresupuestoPdf> {
    const { data: { user } } = await supabase.auth.getUser()

    // Generar nombre único para el archivo
    const fileExt = file.name.split('.').pop()
    const fileName = `${leadId}/${Date.now()}_${nombre.replace(/\s+/g, '_')}.${fileExt}`

    // Subir archivo a Storage
    const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
        })

    if (uploadError) throw uploadError

    // Obtener URL pública
    const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(fileName)

    const publicUrl = urlData.publicUrl

    // Guardar registro en la tabla
    const { data, error } = await supabase
        .from('presupuesto_pdf')
        .insert({
            lead_id: leadId,
            nombre: nombre,
            url: publicUrl,
            creado_por: user?.id || null
        })
        .select()
        .single()

    if (error) throw error
    return data
}

/**
 * Eliminar un presupuesto PDF
 */
export async function deletePresupuestoPdf(id: string, url: string): Promise<boolean> {
    // Extraer path del archivo desde la URL
    const bucketUrl = `${BUCKET_NAME}/`
    const pathStart = url.indexOf(bucketUrl)

    if (pathStart !== -1) {
        const filePath = url.substring(pathStart + bucketUrl.length)

        // Eliminar archivo de Storage
        const { error: storageError } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([filePath])

        if (storageError) {
            console.warn('[presupuestosPdf] Error eliminando archivo de storage:', storageError)
        }
    }

    // Eliminar registro de la tabla
    const { error } = await supabase
        .from('presupuesto_pdf')
        .delete()
        .eq('id', id)

    if (error) throw error
    return true
}

/**
 * Obtener conteo de presupuestos por lead
 */
export async function getPresupuestosCountByLeads(leadIds: string[]): Promise<Record<string, number>> {
    if (!leadIds.length) return {}

    const { data, error } = await supabase
        .from('presupuesto_pdf')
        .select('lead_id')
        .in('lead_id', leadIds)

    if (error) throw error

    const counts: Record<string, number> = {};
    (data || []).forEach(row => {
        counts[row.lead_id] = (counts[row.lead_id] || 0) + 1
    })
    return counts
}
