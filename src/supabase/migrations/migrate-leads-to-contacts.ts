/**
 * migrate-leads-to-contacts.ts
 * Script para migrar leads existentes a la tabla persona y crear relaciones
 */

import { supabase } from '../client'

interface LeadDB {
    id: string
    nombre_completo: string
    correo_electronico: string
    telefono: string | null
    empresa: string | null
    pipeline_id: string
    empresa_id: string
}

/**
 * Migra los leads existentes a contactos (personas) y crea las relaciones
 */
export async function migrateLeadsToContacts(empresaId: string) {
    try {
        console.log('🚀 Iniciando migración de leads a contactos...')

        // 1. Obtener el equipo_id de la empresa
        const { data: equipos, error: equipoError } = await supabase
            .from('equipos')
            .select('id')
            .eq('empresa_id', empresaId)
            .limit(1)
            .single()

        if (equipoError || !equipos) {
            throw new Error('No se encontró equipo para la empresa')
        }

        const equipoId = equipos.id
        console.log(`✓ Equipo encontrado: ${equipoId}`)

        // 2. Obtener todos los leads de la empresa
        const { data: leads, error: leadsError } = await supabase
            .from('lead')
            .select('*')
            .eq('empresa_id', empresaId)
            .eq('archived', false)

        if (leadsError) throw leadsError

        if (!leads || leads.length === 0) {
            console.log('⚠️  No se encontraron leads para migrar')
            return { success: true, contactsCreated: 0, relationsCreated: 0, totalLeadsProcessed: 0 }
        }

        console.log(`✓ Se encontraron ${leads.length} leads`)

        // 3. Crear un mapa de contactos únicos (por email o nombre completo)
        const uniqueContactsMap = new Map<string, LeadDB>()

        for (const lead of leads) {
            // Usar email como clave única, o nombre si no hay email
            const key = lead.correo_electronico || lead.nombre_completo

            // Solo agregar si no existe o si este lead es más completo
            if (!uniqueContactsMap.has(key)) {
                uniqueContactsMap.set(key, lead)
            }
        }

        console.log(`✓ Se identificaron ${uniqueContactsMap.size} contactos únicos`)

        // 4. Insertar contactos en la tabla persona (solo campos básicos)
        const contactsToInsert = Array.from(uniqueContactsMap.values()).map(lead => ({
            nombre_completo: lead.nombre_completo,
            email: lead.correo_electronico || `noemail-${lead.id}@temp.com`, // Email obligatorio
            telefono: lead.telefono,
            empresa: lead.empresa,
            equipo_id: equipoId
        }))

        const { data: insertedContacts, error: insertError } = await supabase
            .from('persona')
            .insert(contactsToInsert)
            .select()

        if (insertError) {
            console.error('Error insertando contactos:', insertError)
            throw insertError
        }

        console.log(`✓ Se crearon/actualizaron ${insertedContacts?.length || 0} contactos`)

        // 5. Refrescar contactos de la base de datos para obtener IDs
        const { data: allPersonas, error: personasError } = await supabase
            .from('persona')
            .select('*')
            .eq('equipo_id', equipoId)

        if (personasError) throw personasError

        // 6. Crear un mapa de email/nombre -> persona_id
        const personaMap = new Map<string, string>()
        for (const persona of allPersonas || []) {
            const key = persona.email || persona.nombre_completo
            personaMap.set(key, persona.id)
        }

        // 7. Crear relaciones en persona_pipeline
        const relationsToInsert: { persona_id: string; pipeline_id: string }[] = []

        for (const lead of leads) {
            const key = lead.correo_electronico || lead.nombre_completo
            const personaId = personaMap.get(key)

            if (personaId && lead.pipeline_id) {
                relationsToInsert.push({
                    persona_id: personaId,
                    pipeline_id: lead.pipeline_id
                })
            }
        }

        // Eliminar duplicados
        const uniqueRelations = Array.from(
            new Set(relationsToInsert.map(r => `${r.persona_id}-${r.pipeline_id}`))
        ).map(key => {
            const [persona_id, pipeline_id] = key.split('-')
            return { persona_id, pipeline_id }
        })

        console.log(`✓ Se identificaron ${uniqueRelations.length} relaciones únicas`)

        // Insertar relaciones
        if (uniqueRelations.length > 0) {
            const { error: relationsError } = await supabase
                .from('persona_pipeline')
                .upsert(uniqueRelations, {
                    onConflict: 'persona_id,pipeline_id',
                    ignoreDuplicates: true
                })

            if (relationsError) {
                console.error('Error creando relaciones:', relationsError)
                // No lanzar error, solo informar
                console.warn('⚠️  Algunas relaciones no se pudieron crear')
            } else {
                console.log(`✓ Se crearon ${uniqueRelations.length} relaciones persona-pipeline`)
            }
        }

        console.log('✅ Migración completada exitosamente!')

        return {
            success: true,
            contactsCreated: insertedContacts?.length || 0,
            relationsCreated: uniqueRelations.length,
            totalLeadsProcessed: leads.length
        }

    } catch (error) {
        console.error('❌ Error en la migración:', error)
        throw error
    }
}

/**
 * Hook de ayuda para ejecutar la migración desde el navegador
 */
export function useMigration() {
    const runMigration = async (empresaId: string) => {
        return await migrateLeadsToContacts(empresaId)
    }

    return { runMigration }
}

// Exportar función global para usar en consola del navegador
if (typeof window !== 'undefined') {
    (window as any).migrateLeadsToContacts = migrateLeadsToContacts
    console.log('💡 Función disponible: window.migrateLeadsToContacts(empresaId)')
}
