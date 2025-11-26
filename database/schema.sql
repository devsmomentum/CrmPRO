-- ============================================================
-- USUARIOS
-- ============================================================
alter table usuarios enable row level security;

create policy usuarios_select_self on usuarios
  for select
  using (id = auth.uid());

create policy usuarios_update_self on usuarios
  for update
  using (id = auth.uid());


-- ============================================================
-- EMPRESA
-- ============================================================
alter table empresa enable row level security;

create policy empresa_select on empresa
  for select
  using (usuario_id = auth.uid());

create policy empresa_update on empresa
  for update
  using (usuario_id = auth.uid());

create policy empresa_insert on empresa
  for insert
  with check (usuario_id = auth.uid());

create policy empresa_delete on empresa
  for delete
  using (usuario_id = auth.uid());


-- ============================================================
-- PANEL
-- ============================================================
alter table panel enable row level security;

create policy panel_rw on panel
  for all
  using (
    empresa_id in (
      select id from empresa
      where usuario_id = auth.uid()
    )
  )
  with check (
    empresa_id in (
      select id from empresa
      where usuario_id = auth.uid()
    )
  );


-- ============================================================
-- PIPELINE
-- ============================================================
alter table pipeline enable row level security;

create policy pipeline_rw on pipeline
  for all
  using (
    empresa_id in (
      select id from empresa
      where usuario_id = auth.uid()
    )
  )
  with check (
    empresa_id in (
      select id from empresa
      where usuario_id = auth.uid()
    )
  );


-- ============================================================
-- ETAPAS
-- ============================================================
alter table etapas enable row level security;

create policy etapas_rw on etapas
  for all
  using (
    pipeline_id in (
      select p.id
      from pipeline p
      join empresa e on p.empresa_id = e.id
      where e.usuario_id = auth.uid()
    )
  )
  with check (
    pipeline_id in (
      select p.id
      from pipeline p
      join empresa e on p.empresa_id = e.id
      where e.usuario_id = auth.uid()
    )
  );


-- ============================================================
-- EQUIPOS
-- ============================================================
alter table equipos enable row level security;

create policy equipos_rw on equipos
  for all
  using (
    empresa_id in (
      select id from empresa
      where usuario_id = auth.uid()
    )
  )
  with check (
    empresa_id in (
      select id from empresa
      where usuario_id = auth.uid()
    )
  );


-- ============================================================
-- PERSONA
-- ============================================================
alter table persona enable row level security;

create policy persona_rw on persona
  for all
  using (
    equipo_id in (
      select eq.id
      from equipos eq
      join empresa e on eq.empresa_id = e.id
      where e.usuario_id = auth.uid()
    )
  )
  with check (
    equipo_id in (
      select eq.id
      from equipos eq
      join empresa e on eq.empresa_id = e.id
      where e.usuario_id = auth.uid()
    )
  );

CREATE TABLE lead (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_completo text NOT NULL,
  correo_electronico text NOT NULL,
  telefono text,
  empresa text,
  presupuesto numeric,
  etapa_id uuid REFERENCES etapas(id),
  pipeline_id uuid REFERENCES pipeline(id),
  prioridad text,
  asignado_a uuid, -- referencia a usuario/persona si lo deseas
  empresa_id uuid NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE lead ENABLE ROW LEVEL SECURITY;

-- Política: solo pueden ver/editar leads de su empresa
CREATE POLICY lead_rw ON lead
  FOR ALL
  USING (
    empresa_id IN (
      SELECT id FROM empresa WHERE usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    empresa_id IN (
      SELECT id FROM empresa WHERE usuario_id = auth.uid()
    )
  );


  alter table persona_pipeline enable row level security;

-- SELECT
create policy select_persona_pipeline on persona_pipeline
for select
to authenticated
using (
  persona_id in (
    select p.id
    from persona p
    join equipos eq on p.equipo_id = eq.id
    join empresa e on eq.empresa_id = e.id
    where e.usuario_id = auth.uid()
  )
  AND
  pipeline_id in (
    select pl.id
    from pipeline pl
    join empresa e on pl.empresa_id = e.id
    where e.usuario_id = auth.uid()
  )
);

-- INSERT
create policy insert_persona_pipeline on persona_pipeline
for insert
to authenticated
with check (
  persona_id in (
    select p.id
    from persona p
    join equipos eq on p.equipo_id = eq.id
    join empresa e on eq.empresa_id = e.id
    where e.usuario_id = auth.uid()
  )
  AND
  pipeline_id in (
    select pl.id
    from pipeline pl
    join empresa e on pl.empresa_id = e.id
    where e.usuario_id = auth.uid()
  )
);

-- UPDATE
create policy update_persona_pipeline on persona_pipeline
for update
to authenticated
using (
  persona_id in (
    select p.id
    from persona p
    join equipos eq on p.equipo_id = eq.id
    join empresa e on eq.empresa_id = e.id
    where e.usuario_id = auth.uid()
  )
  AND
  pipeline_id in (
    select pl.id
    from pipeline pl
    join empresa e on pl.empresa_id = e.id
    where e.usuario_id = auth.uid()
  )
)
with check (
  persona_id in (
    select p.id
    from persona p
    join equipos eq on p.equipo_id = eq.id
    join empresa e on eq.empresa_id = e.id
    where e.usuario_id = auth.uid()
  )
  AND
  pipeline_id in (
    select pl.id
    from pipeline pl
    join empresa e on pl.empresa_id = e.id
    where e.usuario_id = auth.uid()
  )
);

-- DELETE
create policy delete_persona_pipeline on persona_pipeline
for delete
to authenticated
using (
  persona_id in (
    select p.id
    from persona p
    join equipos eq on p.equipo_id = eq.id
    join empresa e on eq.empresa_id = e.id
    where e.usuario_id = auth.uid()
  )
  AND
  pipeline_id in (
    select pl.id
    from pipeline pl
    join empresa e on pl.empresa_id = e.id
    where e.usuario_id = auth.uid()
  )
);



ALTER TABLE etapas ADD COLUMN IF NOT EXISTS color text DEFAULT '#3b82f6';
ALTER TABLE etapas ADD COLUMN IF NOT EXISTS nombre text;
ALTER TABLE etapas ADD COLUMN IF NOT EXISTS orden integer DEFAULT 0;

ALTER TABLE lead
DROP CONSTRAINT IF EXISTS lead_etapa_id_fkey;

ALTER TABLE lead
ADD CONSTRAINT lead_etapa_id_fkey
FOREIGN KEY (etapa_id)
REFERENCES etapas(id)
ON DELETE CASCADE;


-- Tabla de invitaciones para unirse a equipos
create table if not exists equipo_invitaciones (
  id uuid primary key default gen_random_uuid(),
  equipo_id uuid not null references equipos(id) on delete cascade,
  empresa_id uuid not null references empresa(id) on delete cascade,
  invited_email text not null,
  invited_usuario_id uuid references usuarios(id), -- opcional si ya existe el usuario interno
  status text not null default 'pending', -- pending | accepted | rejected | canceled
  created_at timestamptz default now(),
  responded_at timestamptz,
  invited_nombre text,
  invited_titulo_trabajo text,
  pipeline_ids uuid[]
);

-- Índice para buscar rápido por correo
create index if not exists idx_equipo_invitaciones_invited_email on equipo_invitaciones(invited_email);

-- Habilitar RLS
alter table equipo_invitaciones enable row level security;

-- SELECT: propietario de la empresa o invitado
create policy equipo_invitaciones_select on equipo_invitaciones
  for select
  to authenticated
  using (
    empresa_id in (select id from empresa where usuario_id = auth.uid())
    or invited_email = (auth.jwt() ->> 'email')
  );

-- INSERT: solo propietario de la empresa
create policy equipo_invitaciones_insert on equipo_invitaciones
  for insert
  to authenticated
  with check (
    empresa_id in (select id from empresa where usuario_id = auth.uid())
  );

-- UPDATE: invitado puede aceptar/rechazar su propia invitación
create policy equipo_invitaciones_update_invited on equipo_invitaciones
  for update
  to authenticated
  using (
    invited_email = (auth.jwt() ->> 'email')
  )
  with check (
    invited_email = (auth.jwt() ->> 'email')
  );

-- UPDATE: dueño de empresa puede cancelar
create policy equipo_invitaciones_update_owner on equipo_invitaciones
  for update
  to authenticated
  using (
    empresa_id in (select id from empresa where usuario_id = auth.uid())
  )
  with check (
    empresa_id in (select id from empresa where usuario_id = auth.uid())
  );

-- Agregar columna usuario_id a persona para vincular con auth.users
alter table persona add column if not exists usuario_id uuid references auth.users(id);

-- Política persona: permitir insert si existe invitación aceptada para ese equipo y email
create policy persona_insert_invited on persona
  for insert
  to authenticated
  with check (
    exists (
      select 1 from equipo_invitaciones ei
      where ei.equipo_id = persona.equipo_id
        and ei.invited_email = (auth.jwt() ->> 'email')
        and ei.status = 'accepted'
    )
  );

-- Políticas para persona_pipeline: permitir insert si persona pertenece a invitación aceptada
create policy persona_pipeline_insert_invited on persona_pipeline
  for insert
  to authenticated
  with check (
    exists (
      select 1 from persona p
      join equipo_invitaciones ei on p.equipo_id = ei.equipo_id
      where p.id = persona_pipeline.persona_id
        and ei.invited_email = (auth.jwt() ->> 'email')
        and ei.status = 'accepted'
    )
  );

create table if not exists notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_email text not null,
  type text not null, -- invitation | invitation_accepted | task | message | appointment | stage_change
  title text not null,
  message text not null,
  data jsonb,
  read boolean default false,
  created_at timestamptz default now()
);

alter table notificaciones enable row level security;

-- Un usuario ve solo sus notificaciones
create policy notificaciones_select_self on notificaciones
  for select
  to authenticated
  using (usuario_email = (auth.jwt() ->> 'email'));

-- Insert permitidos (cualquier usuario autenticado puede generar notificación para sí mismo)
create policy notificaciones_insert_self on notificaciones
  for insert
  to authenticated
  with check (usuario_email = (auth.jwt() ->> 'email'));

-- Update para marcar como leída
create policy notificaciones_update_self on notificaciones
  for update
  to authenticated
  using (usuario_email = (auth.jwt() ->> 'email'))
  with check (usuario_email = (auth.jwt() ->> 'email'));

create index if not exists idx_notificaciones_email_created on notificaciones(usuario_email, created_at desc);

-- ============================================================
-- INVITACIONES (Update)
-- ============================================================
ALTER TABLE equipo_invitaciones ADD COLUMN IF NOT EXISTS token text;
CREATE INDEX IF NOT EXISTS idx_equipo_invitaciones_token ON equipo_invitaciones(token);

create or replace function accept_invitation(invite_token text, current_user_id uuid)
returns json as \$\$
declare
  invite_record record;
  new_member_id uuid;
begin
  -- 1. Buscar la invitaci�n
  select * into invite_record from equipo_invitaciones where token = invite_token;

  if invite_record is null then
    raise exception 'Invitaci�n inv�lida o expirada';
  end if;

  if invite_record.status != 'pending' then
     raise exception 'Esta invitaci�n ya ha sido procesada';
  end if;

  -- 2. Insertar en persona (miembros del equipo)
  insert into persona (nombre, email, titulo_trabajo, equipo_id, usuario_id)
  values (
    invite_record.invited_nombre, 
    invite_record.invited_email, 
    invite_record.invited_titulo_trabajo, 
    invite_record.equipo_id, 
    current_user_id
  )
  returning id into new_member_id;

  -- 3. Actualizar la invitaci�n
  update equipo_invitaciones 
  set status = 'accepted', 
      responded_at = now(), 
      invited_usuario_id = current_user_id 
  where id = invite_record.id;

  return json_build_object('member_id', new_member_id);
end;
\$\$ language plpgsql security definer;

