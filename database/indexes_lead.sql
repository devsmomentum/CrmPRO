-- Recommended indexes for lead table performance at scale
-- Safe to run multiple times with IF NOT EXISTS

create index if not exists idx_lead_empresa_id_created on lead(empresa_id, created_at desc);
create index if not exists idx_lead_empresa_pipeline on lead(empresa_id, pipeline_id);
create index if not exists idx_lead_empresa_etapa on lead(empresa_id, etapa_id);
create index if not exists idx_lead_asignado on lead(asignado_a);
create index if not exists idx_lead_email on lead(lower(correo_electronico));
create index if not exists idx_lead_telefono on lead(telefono);
