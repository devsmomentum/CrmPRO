import { supabase } from '../client'

// Verifica si la tabla empresa existe y lista sus columnas básicas
export async function verifyEmpresaTable() {
  console.log('[EMPRESA:DIAG] Verificando estructura tabla empresa')
  const { data, error } = await supabase
    .from('empresa')
    .select('id, nombre_empresa, usuario_id, created_at')
    .limit(1)
  if (error) {
    console.error('[EMPRESA:DIAG] Error acceso tabla empresa', error)
    return { ok: false, error }
  }
  console.log('[EMPRESA:DIAG] Acceso ok. Muestra fila ejemplo (puede ser null si vacía):', data)
  return { ok: true, sample: data?.[0] || null }
}

// Inserta una empresa controlada y re-lee para confirmar persistencia
export async function testInsertEmpresa(nombre = 'EmpresaDiag') {
  const { data: sessionData } = await supabase.auth.getSession()
  const uid = sessionData?.session?.user?.id
  console.log('[EMPRESA:DIAG] Session UID', uid)
  if (!uid) throw new Error('No hay sesión activa para testInsertEmpresa')
  const payload = { nombre_empresa: nombre, usuario_id: uid }
  console.log('[EMPRESA:DIAG] Insert payload', payload)
  const { data: inserted, error: insertError } = await supabase
    .from('empresa')
    .insert(payload)
    .select()
    .single()
  if (insertError) {
    console.error('[EMPRESA:DIAG] Insert error', insertError)
    throw insertError
  }
  console.log('[EMPRESA:DIAG] Insert retorno', inserted)
  if (!inserted?.id) {
    console.warn('[EMPRESA:DIAG] Insert sin id devuelto')
    return inserted
  }
  const { data: reread, error: rereadError } = await supabase
    .from('empresa')
    .select('*')
    .eq('id', inserted.id)
    .single()
  if (rereadError) {
    console.error('[EMPRESA:DIAG] Relectura error', rereadError)
  } else {
    console.log('[EMPRESA:DIAG] Relectura confirmación', reread)
  }
  return { inserted, reread }
}

// Lista todas las empresas visibles para el usuario actual
export async function listEmpresasCurrentUser() {
  const { data: sessionData } = await supabase.auth.getSession()
  const uid = sessionData?.session?.user?.id
  if (!uid) throw new Error('No hay sesión activa para listar empresas')
  const { data, error } = await supabase
    .from('empresa')
    .select('*')
    .eq('usuario_id', uid)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[EMPRESA:DIAG] Error listando empresas', error)
    throw error
  }
  console.log('[EMPRESA:DIAG] Empresas visibles', data?.length || 0, data)
  return data
}

// Intenta un insert con un usuario_id distinto para confirmar RLS
export async function testRLSViolation(fakeUid) {
  const payload = { nombre_empresa: 'RLSViolationTest', usuario_id: fakeUid }
  console.log('[EMPRESA:DIAG] Probando RLS violación', payload)
  const { error } = await supabase
    .from('empresa')
    .insert(payload)
  if (error) {
    console.log('[EMPRESA:DIAG] Resultado esperado (violación RLS)', error.message)
    return true
  }
  console.warn('[EMPRESA:DIAG] ERROR: Inserción con fakeUid no falló, revisar políticas RLS')
  return false
}
