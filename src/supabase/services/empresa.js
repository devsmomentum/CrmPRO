import { supabase } from '../client'

export async function createEmpresa({ nombre_empresa, usuario_id, logo_url }) {
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
  if (logo_url) insertPayload.logo_url = logo_url
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

export async function updateEmpresaLogo(empresa_id, logo_url) {
  if (!empresa_id) throw new Error('empresa_id requerido')
  if (!logo_url) throw new Error('logo_url requerido')
  const { data, error } = await supabase
    .from('empresa')
    .update({ logo_url })
    .eq('id', empresa_id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateEmpresa(empresa_id, updates) {
  if (!empresa_id) throw new Error('empresa_id requerido')
  const { data, error } = await supabase
    .from('empresa')
    .update(updates)
    .eq('id', empresa_id)
    .select('*')
    .single()
  if (error) throw error
  return data
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
        created_at,
        logo_url
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

export async function updateCompanyMemberRole(companyId, { usuario_id, email, role }) {
  if (!companyId) throw new Error('companyId requerido')
  if (!role) throw new Error('role requerido')

  // Preferir email (más estable) y luego usuario_id
  if (email) {
    // Intentar case-insensitive por email
    const { data, error } = await supabase
      .from('empresa_miembros')
      .update({ role })
      .eq('empresa_id', companyId)
      .ilike('email', email)
      .select('usuario_id, email, role')
    if (error) throw error
    return data
  }
  if (usuario_id) {
    const { data, error } = await supabase
      .from('empresa_miembros')
      .update({ role })
      .eq('empresa_id', companyId)
      .eq('usuario_id', usuario_id)
      .select('usuario_id, email, role')
    if (error) throw error
    return data
  }
  throw new Error('usuario_id o email requerido para actualizar rol')
}

// Crea o actualiza el rol de un miembro en empresa_miembros cuando no existe registro previo
export async function upsertCompanyMemberRole(companyId, { email, usuario_id, role }) {
  if (!companyId) throw new Error('companyId requerido')
  if (!role) throw new Error('role requerido')
  const payload = { empresa_id: companyId, role }
  if (email) payload.email = email
  if (usuario_id) payload.usuario_id = usuario_id

  // Manual upsert: buscar por email o usuario_id y luego update/insert
  let found = null
  if (email) {
    const { data: existingByEmail, error: findErr } = await supabase
      .from('empresa_miembros')
      .select('usuario_id, email, role')
      .eq('empresa_id', companyId)
      .ilike('email', email)
    if (findErr) throw findErr
    found = (existingByEmail || [])[0] || null
  }
  if (!found && usuario_id) {
    const { data: existingByUid, error: findErr2 } = await supabase
      .from('empresa_miembros')
      .select('usuario_id, email, role')
      .eq('empresa_id', companyId)
      .eq('usuario_id', usuario_id)
    if (findErr2) throw findErr2
    found = (existingByUid || [])[0] || null
  }

  if (found) {
    // update
    if (email) {
      const { data, error } = await supabase
        .from('empresa_miembros')
        .update({ role })
        .eq('empresa_id', companyId)
        .ilike('email', email)
        .select('usuario_id, email, role')
      if (error) throw error
      return data
    }
    const { data, error } = await supabase
      .from('empresa_miembros')
      .update({ role })
      .eq('empresa_id', companyId)
      .eq('usuario_id', usuario_id)
      .select('usuario_id, email, role')
    if (error) throw error
    return data
  } else {
    // insert: si la columna usuario_id es NOT NULL en la BD, requerimos usuario_id
    if (!usuario_id) {
      throw new Error('No se puede crear empresa_miembros sin usuario_id (la columna es NOT NULL).')
    }
    const { data, error } = await supabase
      .from('empresa_miembros')
      .insert(payload)
      .select('usuario_id, email, role')
    if (error) throw error
    return data
  }
}

export async function leaveCompany(companyId, userEmail, userId) {
  console.log('[EMPRESA] leaveCompany', { companyId, userEmail, userId })

  // 1. Get company owner to notify
  let ownerEmail = null
  let companyName = 'la empresa'
  try {
    const { data: companyData } = await supabase
      .from('empresa')
      .select('nombre_empresa, usuario_id')
      .eq('id', companyId)
      .single()

    if (companyData) {
      companyName = companyData.nombre_empresa
      const { data: ownerData } = await supabase
        .from('usuarios')
        .select('email')
        .eq('id', companyData.usuario_id)
        .single()
      if (ownerData) ownerEmail = ownerData.email
    }
  } catch (e) {
    console.warn('[EMPRESA] could not fetch owner info for notification', e)
  }

  // 2. Delete from persona (team members) - MUST BE DONE BEFORE REMOVING MEMBERSHIP
  // because RLS policies for persona usually depend on being a member of the company.

  // First get all teams in this company
  const { data: teams, error: teamsError } = await supabase
    .from('equipos')
    .select('id')
    .eq('empresa_id', companyId)

  if (!teamsError && teams && teams.length > 0) {
    const teamIds = teams.map(t => t.id)

    // Try deleting by usuario_id first (more reliable)
    const { error: personaErrorId } = await supabase
      .from('persona')
      .delete()
      .in('equipo_id', teamIds)
      .eq('usuario_id', userId)

    if (personaErrorId) {
      console.warn('[EMPRESA] error deleting personas by ID, trying email', personaErrorId)
      // Fallback to email
      const { error: personaErrorEmail } = await supabase
        .from('persona')
        .delete()
        .in('equipo_id', teamIds)
        .eq('email', userEmail)

      if (personaErrorEmail) console.error('[EMPRESA] error deleting personas by email', personaErrorEmail)
    }
  }

  // 3. Delete from empresa_miembros
  // We use count: 'exact' to verify if the row was actually deleted.
  // If RLS denies the delete, no error is thrown but count will be 0.
  const { error: memberError, count } = await supabase
    .from('empresa_miembros')
    .delete({ count: 'exact' })
    .eq('empresa_id', companyId)
    .eq('usuario_id', userId)

  if (memberError) {
    console.error('[EMPRESA] error deleting member', memberError)
    throw memberError
  }

  // If count is 0, it means the user couldn't delete the row (likely permission denied by RLS)
  // or the row didn't exist. We should probably warn or throw if we expected it to exist.
  if (count === 0) {
    console.warn('[EMPRESA] Warning: No empresa_miembros row deleted. Possible RLS permission issue.')
  }

  // 4. Send notification to owner
  if (ownerEmail) {
    try {
      await supabase
        .from('notificaciones')
        .insert({
          usuario_email: ownerEmail,
          type: 'message',
          title: 'Usuario abandonó la empresa',
          message: `El usuario ${userEmail} ha abandonado la empresa ${companyName}`
        })
    } catch (e) {
      console.error('[EMPRESA] error sending notification', e)
    }
  }

  return true
}

export async function removeMemberFromCompany(companyId, email) {
  console.log('[EMPRESA] removeMemberFromCompany', { companyId, email })

  // Intentar usar la Edge Function primero (bypassing RLS)
  const { error: funcError } = await supabase.functions.invoke('remove-member', {
    body: { companyId, email }
  })

  if (!funcError) {
    return true
  }

  console.warn('[EMPRESA] Edge Function falló, intentando eliminación directa...', funcError)

  // Fallback: Eliminación directa (puede fallar por RLS si es admin borrando admin)
  // 1. Remove from persona (all teams in this company) - MUST BE DONE FIRST
  // because RLS policies for persona usually depend on being a member of the company.
  // First get all teams
  const { data: teams } = await supabase
    .from('equipos')
    .select('id')
    .eq('empresa_id', companyId)

  if (teams && teams.length > 0) {
    const teamIds = teams.map(t => t.id)
    const { error: personaError } = await supabase
      .from('persona')
      .delete()
      .in('equipo_id', teamIds)
      .ilike('email', email)

    if (personaError) {
      console.error('[EMPRESA] error removing persona', personaError)
      // Don't throw here - continue to remove from empresa_miembros anyway
    }
  }

  // 2. Remove from empresa_miembros
  // We try to delete by email since we might not have the user_id handy, 
  // and email should be unique enough within the context of membership invites
  const { error: memberError } = await supabase
    .from('empresa_miembros')
    .delete()
    .eq('empresa_id', companyId)
    .ilike('email', email)

  if (memberError) {
    console.error('[EMPRESA] error removing member from company', memberError)
    throw memberError
  }

  return true
}
