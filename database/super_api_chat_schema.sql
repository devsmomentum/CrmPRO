-- Tabla para agrupar los chats/sesiones
create table public.conversaciones (
  id uuid not null default gen_random_uuid (),
  external_id text not null, -- ID que viene de Super API
  lead_id uuid null, -- Relación opcional con la tabla 'lead'
  customer_name text null,
  status text not null default 'active', -- active, closed, archived
  platform text default 'super_api',
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint conversaciones_pkey primary key (id),
  constraint conversaciones_external_id_unique unique (external_id),
  constraint conversaciones_lead_id_fkey foreign KEY (lead_id) references lead (id) on delete SET NULL
) TABLESPACE pg_default;

-- Tabla para los mensajes individuales
create table public.mensajes (
  id uuid not null default gen_random_uuid (),
  conversation_id uuid not null,
  content text not null,
  direction text not null, -- 'inbound' (cliente->crm) o 'outbound' (crm->cliente)
  external_timestamp timestamp with time zone null, -- Hora original del mensaje si viene de fuera
  created_at timestamp with time zone null default now(),
  constraint mensajes_pkey primary key (id),
  constraint mensajes_conversation_id_fkey foreign KEY (conversation_id) references conversaciones (id) on delete CASCADE
) TABLESPACE pg_default;

-- Habilitar Realtime para que el chat se actualice solo
alter publication supabase_realtime add table public.mensajes;
alter publication supabase_realtime add table public.conversaciones;
