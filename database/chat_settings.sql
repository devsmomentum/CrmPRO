-- Tabla de configuración de chat por empresa
create table if not exists chat_settings (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresa(id) on delete cascade,
  keywords text[] default '{}',
  updated_at timestamptz default now()
);

create index if not exists idx_chat_settings_empresa on chat_settings(empresa_id);
create unique index if not exists ux_chat_settings_empresa on chat_settings(empresa_id);

-- Habilitar RLS y políticas basadas en empresa.usuario_id
alter table chat_settings enable row level security;

create policy if not exists chat_settings_select_owner
on chat_settings for select
to authenticated
using (
  exists (
    select 1 from empresa e
    where e.id = chat_settings.empresa_id
      and e.usuario_id = auth.uid()
  )
);

create policy if not exists chat_settings_insert_owner
on chat_settings for insert
to authenticated
with check (
  exists (
    select 1 from empresa e
    where e.id = chat_settings.empresa_id
      and e.usuario_id = auth.uid()
  )
);

create policy if not exists chat_settings_update_owner
on chat_settings for update
to authenticated
using (
  exists (
    select 1 from empresa e
    where e.id = chat_settings.empresa_id
      and e.usuario_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from empresa e
    where e.id = chat_settings.empresa_id
      and e.usuario_id = auth.uid()
  )
);
