import { supabase } from '../client'

export type Integration = {
  id: string
  empresa_id: string
  provider: string
  status: 'active' | 'disabled'
  metadata: Record<string, any> | null
  created_at: string
  updated_at: string
}

export type Credential = {
  id: string
  integracion_id: string
  key: string
  value: string
  created_at: string
  updated_at: string
}

export async function isFeatureEnabled(key: string, empresaId?: string): Promise<boolean> {
  // 1) Intentar override por empresa
  if (empresaId) {
    const { data: companyFlag, error: cfErr } = await supabase
      .from('feature_flags')
      .select('enabled')
      .eq('key', key)
      .eq('scope', 'empresa')
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (!cfErr && companyFlag && typeof companyFlag.enabled === 'boolean') {
      return !!companyFlag.enabled
    }
  }

  // 2) Fallback a global
  const { data: globalFlag, error: gErr } = await supabase
    .from('feature_flags')
    .select('enabled')
    .eq('key', key)
    .eq('scope', 'global')
    .is('empresa_id', null)
    .maybeSingle()

  if (gErr) return false
  return !!globalFlag?.enabled
}

export async function getIntegrationWithCredentials(empresaId: string, provider: string): Promise<{ integration: Integration | null, credentials: Record<string, string> }> {
  const { data: integration, error: iErr } = await supabase
    .from('integraciones')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('provider', provider)
    .maybeSingle()

  if (iErr || !integration) return { integration: null, credentials: {} }

  const { data: creds, error: cErr } = await supabase
    .from('integracion_credenciales')
    .select('*')
    .eq('integracion_id', integration.id)

  if (cErr || !creds) return { integration, credentials: {} }

  const map: Record<string, string> = {}
  for (const c of creds as Credential[]) {
    map[c.key] = c.value
  }
  return { integration: integration as Integration, credentials: map }
}

export async function upsertIntegration(empresaId: string, provider: string, metadata?: Record<string, any>) {
  const { data, error } = await supabase
    .from('integraciones')
    .upsert({ empresa_id: empresaId, provider, metadata }, { onConflict: 'empresa_id,provider' })
    .select('*')
    .single()
  if (error) throw error
  return data as Integration
}

export async function upsertCredential(integracionId: string, key: string, value: string) {
  const { data, error } = await supabase
    .from('integracion_credenciales')
    .upsert({ integracion_id: integracionId, key, value }, { onConflict: 'integracion_id,key' })
    .select('*')
    .single()
  if (error) throw error
  return data as Credential
}
