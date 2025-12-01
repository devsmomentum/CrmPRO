import { supabase } from '../client'

export async function createEmpresa({ nombre_empresa, usuario_id }) {
  console.log('[EMPRESA] createEmpresa inicio', { nombre_empresa, usuario_id })
  const { data: sessionData } = await supabase.auth.getSession()
  const currentUid = sessionData?.session?.user?.id
  console.log('[EMPRESA] sesión actual UID', currentUid)
  if (!currentUid) {
    throw new Error('No hay sesión activa para crear empresa (UID vacío).')
  }
  if (currentUid !== usuario_id) {
    console.warn('[EMPRESA] UID de sesión y usuario_id difieren', { currentUid, usuario_id })
  }
  const insertPayload = { nombre_empresa, usuario_id }
  console.log('[EMPRESA] payload insert', insertPayload)
  const { data: inserted, error: insertError } = await supabase
    .from('empresa')
    .insert(insertPayload)
    .select()
    .single()
  if (insertError) {
    console.error('[EMPRESA] error insert empresa', insertError)
    throw insertError
  }
  console.log('[EMPRESA] empresa insertada retorno inmediato', inserted)
  // Verificación adicional leyendo por id si existe el campo id
  if (inserted?.id) {
    const { data: reread, error: rereadError } = await supabase
      .from('empresa')
      .select('*')
      .eq('id', inserted.id)
      .single()
    if (rereadError) {
      console.error('[EMPRESA] error releyendo empresa', rereadError)
    } else {
      console.log('[EMPRESA] empresa reread confirmación', reread)
    }
  } else {
    console.warn('[EMPRESA] insert no devolvió id, revisar políticas / RETURNING')
  }
  return inserted
}

export async function getEmpresasByUsuario(usuario_id) {
  console.log('[EMPRESA] getEmpresasByUsuario', usuario_id)
  
  // 1. Empresas propias
  const { data: owned, error: ownedError } = await supabase
    .from('empresa')
    .select('*')
    .eq('usuario_id', usuario_id)
  
  if (ownedError) {
    console.error('[EMPRESA] error getEmpresasByUsuario (owned)', ownedError)
    throw ownedError
  }

  // 2. Empresas donde soy miembro (via empresa_miembros)
  const { data: memberData, error: memberError } = await supabase
    .from('empresa_miembros')
    .select(`
      empresa_id,
      role,
      empresa (
        id,
        nombre_empresa,
        usuario_id,
        created_at
      )
    `)
    .eq('usuario_id', usuario_id)

  if (memberError) {
    console.error('[EMPRESA] error getEmpresasByUsuario (member)', memberError)
    // No lanzamos error fatal, solo logueamos
  }

  const memberCompanies = memberData 
    ? memberData
        .map(m => {
          if (!m.empresa) return null
          return {
            ...m.empresa,
            role: m.role || 'viewer' // Asignar rol obtenido o default
          }
        }) 
        .filter(Boolean)
        .filter((emp, index, self) => 
          index === self.findIndex((t) => (
            t.id === emp.id
          ))
        )
    : []

  // Marcar las empresas propias con rol 'owner'
  const ownedWithRole = (owned || []).map(e => ({ ...e, role: 'owner' }))

  // Combinar y eliminar duplicados (priorizando 'owner' si existe duplicado)
  const allCompanies = [...ownedWithRole, ...memberCompanies].filter((emp, index, self) =>
    index === self.findIndex((t) => (
      t.id === emp.id
    ))
  )

  console.log('[EMPRESA] empresas encontradas (propias + miembro)', allCompanies)
  return allCompanies
}

export async function deleteEmpresa(id) {
  console.log('[EMPRESA] deleteEmpresa', id)
  const { error } = await supabase
    .from('empresa')
    .delete()
    .eq('id', id)
  if (error) {
    console.error('[EMPRESA] error delete empresa', error)
    throw error
  }
  return true
}

export async function getCompanyMembers(companyId) {
  const { data, error } = await supabase
    .from('empresa_miembros')
    .select('usuario_id, email, role')
    .eq('empresa_id', companyId)
  
  if (error) throw error
  return data
}
