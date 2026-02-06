-- ============================================================
-- EMPRESA INSTANCIAS - Multi-Instance Support for SuperAPI
-- ============================================================
-- Esta tabla permite que cada empresa tenga múltiples instancias
-- de SuperAPI (WhatsApp, Instagram, Facebook), cada una con su
-- propio client_id para identificación y enrutamiento de mensajes.

create table if not exists empresa_instancias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresa(id) on delete cascade,
  plataforma text not null check (plataforma in ('whatsapp', 'instagram', 'facebook')),
  client_id text not null, -- Client ID único de SuperAPI para esta instancia
  api_url text, -- URL personalizada de API (opcional, usa default si es null)
  label text, -- Etiqueta descriptiva (ej: "Ventas Principal", "Soporte")
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Constraint: client_id debe ser único globalmente
  constraint uq_empresa_instancias_client_id unique (client_id),
  
  -- Constraint: combinación empresa + plataforma + label debe ser única
  constraint uq_empresa_instancias_label unique (empresa_id, plataforma, label)
);

-- Índices para búsquedas frecuentes
create index if not exists idx_empresa_instancias_empresa_id on empresa_instancias(empresa_id);
create index if not exists idx_empresa_instancias_client_id on empresa_instancias(client_id);
create index if not exists idx_empresa_instancias_active on empresa_instancias(empresa_id, active) where active = true;

-- ============================================================
-- RLS (Row Level Security) para empresa_instancias
-- ============================================================
alter table empresa_instancias enable row level security;

-- Política: owner o miembros de la empresa pueden ver/gestionar instancias
create policy empresa_instancias_rw on empresa_instancias
  for all to authenticated
  using (
    empresa_id in (select id from empresa where usuario_id = auth.uid())
    or empresa_id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
  )
  with check (
    empresa_id in (select id from empresa where usuario_id = auth.uid())
    or empresa_id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
  );

-- ============================================================
-- Agregar columna preferred_instance_id a la tabla lead
-- ============================================================
-- Esta columna almacena la instancia preferida de WhatsApp para
-- este lead, establecida automáticamente en el primer mensaje entrante
alter table lead add column if not exists preferred_instance_id uuid references empresa_instancias(id) on delete set null;

-- Índice para búsquedas por instancia preferida
create index if not exists idx_lead_preferred_instance on lead(preferred_instance_id) where preferred_instance_id is not null;

-- ============================================================
-- Función para actualizar updated_at automáticamente
-- ============================================================
create or replace function update_empresa_instancias_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger empresa_instancias_updated_at
  before update on empresa_instancias
  for each row
  execute function update_empresa_instancias_updated_at();

-- ============================================================
-- Comentarios para documentación
-- ============================================================
comment on table empresa_instancias is 'Almacena múltiples instancias de SuperAPI por empresa (WhatsApp, Instagram, Facebook)';
comment on column empresa_instancias.client_id is 'Client ID único proporcionado por SuperAPI para esta instancia';
comment on column empresa_instancias.label is 'Etiqueta descriptiva para identificar la instancia (ej: "Ventas", "Soporte")';
comment on column empresa_instancias.active is 'Indica si la instancia está activa y puede usarse para enviar/recibir mensajes';
comment on column lead.preferred_instance_id is 'Instancia de WhatsApp preferida para este lead, establecida en el primer mensaje entrante';
