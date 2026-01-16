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
  created_at timestamptz DEFAULT now(),
  archived boolean NOT NULL DEFAULT false,
  archived_at timestamptz
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



create table if not exists empresa_miembros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresa(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text,
  created_at timestamptz default now()
);

alter table empresa_miembros enable row level security;

-- Owner can manage members of their company
drop policy if exists empresa_miembros_owner on empresa_miembros;
create policy empresa_miembros_owner on empresa_miembros
  for all to authenticated
  using (
    empresa_id in (select id from empresa where usuario_id = auth.uid())
  )
  with check (
    empresa_id in (select id from empresa where usuario_id = auth.uid())
  );

-- Member can read their own membership rows
drop policy if exists empresa_miembros_self on empresa_miembros;
create policy empresa_miembros_self on empresa_miembros
  for select to authenticated
  using (usuario_id = auth.uid());


-- 2) Extend RLS: panel (owner OR member)
drop policy if exists panel_rw on panel;
create policy panel_rw on panel
  for all to authenticated
  using (
    panel.empresa_id in (select id from empresa where usuario_id = auth.uid())
    or panel.empresa_id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
  )
  with check (
    panel.empresa_id in (select id from empresa where usuario_id = auth.uid())
    or panel.empresa_id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
  );


-- 3) Extend RLS: equipos (owner OR member)
drop policy if exists equipos_rw on equipos;
create policy equipos_rw on equipos
  for all to authenticated
  using (
    equipos.empresa_id in (select id from empresa where usuario_id = auth.uid())
    or equipos.empresa_id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
  )
  with check (
    equipos.empresa_id in (select id from empresa where usuario_id = auth.uid())
    or equipos.empresa_id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
  );


-- 4) Extend RLS: persona (owner OR member via equipos -> empresa)
drop policy if exists persona_rw on persona;
create policy persona_rw on persona
  for all to authenticated
  using (
    persona.equipo_id in (
      select eq.id
      from equipos eq
      join empresa e on eq.empresa_id = e.id
      where e.usuario_id = auth.uid()
         or e.id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
    )
  )
  with check (
    persona.equipo_id in (
      select eq.id
      from equipos eq
      join empresa e on eq.empresa_id = e.id
      where e.usuario_id = auth.uid()
         or e.id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
    )
  );


-- 5) Extend RLS: persona_pipeline (owner OR member)
-- Replace existing policies with OR membership in both persona and pipeline sides

-- SELECT
drop policy if exists select_persona_pipeline on persona_pipeline;
create policy select_persona_pipeline on persona_pipeline
  for select to authenticated
  using (
    persona_id in (
      select p.id
      from persona p
      join equipos eq on p.equipo_id = eq.id
      join empresa e on eq.empresa_id = e.id
      where e.usuario_id = auth.uid()
         or e.id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
    )
    and
    pipeline_id in (
      select pl.id
      from pipeline pl
      join empresa e on pl.empresa_id = e.id
      where e.usuario_id = auth.uid()
         or e.id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
    )
  );

-- INSERT
drop policy if exists insert_persona_pipeline on persona_pipeline;
create policy insert_persona_pipeline on persona_pipeline
  for insert to authenticated
  with check (
    persona_id in (
      select p.id
      from persona p
      join equipos eq on p.equipo_id = eq.id
      join empresa e on eq.empresa_id = e.id
      where e.usuario_id = auth.uid()
         or e.id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
    )
    and
    pipeline_id in (
      select pl.id
      from pipeline pl
      join empresa e on pl.empresa_id = e.id
      where e.usuario_id = auth.uid()
         or e.id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
    )
  );

-- UPDATE
drop policy if exists update_persona_pipeline on persona_pipeline;
create policy update_persona_pipeline on persona_pipeline
  for update to authenticated
  using (
    persona_id in (
      select p.id
      from persona p
      join equipos eq on p.equipo_id = eq.id
      join empresa e on eq.empresa_id = e.id
      where e.usuario_id = auth.uid()
         or e.id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
    )
    and
    pipeline_id in (
      select pl.id
      from pipeline pl
      join empresa e on pl.empresa_id = e.id
      where e.usuario_id = auth.uid()
         or e.id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
    )
  )
  with check (
    persona_id in (
      select p.id
      from persona p
      join equipos eq on p.equipo_id = eq.id
      join empresa e on eq.empresa_id = e.id
      where e.usuario_id = auth.uid()
         or e.id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
    )
    and
    pipeline_id in (
      select pl.id
      from pipeline pl
      join empresa e on pl.empresa_id = e.id
      where e.usuario_id = auth.uid()
         or e.id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
    )
  );

-- DELETE
drop policy if exists delete_persona_pipeline on persona_pipeline;
create policy delete_persona_pipeline on persona_pipeline
  for delete to authenticated
  using (
    persona_id in (
      select p.id
      from persona p
      join equipos eq on p.equipo_id = eq.id
      join empresa e on eq.empresa_id = e.id
      where e.usuario_id = auth.uid()
         or e.id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
    )
    and
    pipeline_id in (
      select pl.id
      from pipeline pl
      join empresa e on pl.empresa_id = e.id
      where e.usuario_id = auth.uid()
         or e.id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
    )
  );


  create table if not exists empresa_miembros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresa(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text,
  created_at timestamptz default now()
);

alter table empresa_miembros enable row level security;

-- Owner can manage members of their company
drop policy if exists empresa_miembros_owner on empresa_miembros;
create policy empresa_miembros_owner on empresa_miembros
  for all to authenticated
  using (
    empresa_id in (select id from empresa where usuario_id = auth.uid())
  )
  with check (
    empresa_id in (select id from empresa where usuario_id = auth.uid())
  );

-- Member can read their own membership rows
drop policy if exists empresa_miembros_self on empresa_miembros;
create policy empresa_miembros_self on empresa_miembros
  for select to authenticated
  using (usuario_id = auth.uid());


-- 2) Extend RLS: panel (owner OR member)
drop policy if exists panel_rw on panel;
create policy panel_rw on panel
  for all to authenticated
  using (
    panel.empresa_id in (select id from empresa where usuario_id = auth.uid())
    or panel.empresa_id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
  )
  with check (
    panel.empresa_id in (select id from empresa where usuario_id = auth.uid())
    or panel.empresa_id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
  );


-- 3) Extend RLS: equipos (owner OR member)
drop policy if exists equipos_rw on equipos;
create policy equipos_rw on equipos
  for all to authenticated
  using (
    equipos.empresa_id in (select id from empresa where usuario_id = auth.uid())
    or equipos.empresa_id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
  )
  with check (
    equipos.empresa_id in (select id from empresa where usuario_id = auth.uid())
    or equipos.empresa_id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
  );


-- 4) Extend RLS: persona (owner OR member via equipos -> empresa)
drop policy if exists persona_rw on persona;
create policy persona_rw on persona
  for all to authenticated
  using (
    persona.equipo_id in (
      select eq.id
      from equipos eq
      join empresa e on eq.empresa_id = e.id
      where e.usuario_id = auth.uid()
         or e.id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
    )
  )
  with check (
    persona.equipo_id in (
      select eq.id
      from equipos eq
      join empresa e on eq.empresa_id = e.id
      where e.usuario_id = auth.uid()
         or e.id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
    )
  );


-- 5) Extend RLS: persona_pipeline (owner OR member)
-- Replace existing policies with OR membership in both persona and pipeline sides

-- SELECT
drop policy if exists select_persona_pipeline on persona_pipeline;
create policy select_persona_pipeline on persona_pipeline
  for select to authenticated
  using (
    persona_id in (
      select p.id
      from persona p
      join equipos eq on p.equipo_id = eq.id
      join empresa e on eq.empresa_id = e.id
      where e.usuario_id = auth.uid()
         or e.id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
    )
    and
    pipeline_id in (
      select pl.id
      from pipeline pl
      join empresa e on pl.empresa_id = e.id
      where e.usuario_id = auth.uid()
         or e.id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
    )
  );

-- INSERT
drop policy if exists insert_persona_pipeline on persona_pipeline;
create policy insert_persona_pipeline on persona_pipeline
  for insert to authenticated
  with check (
    persona_id in (
      select p.id
      from persona p
      join equipos eq on p.equipo_id = eq.id
      join empresa e on eq.empresa_id = e.id
      where e.usuario_id = auth.uid()
         or e.id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
    )
    and
    pipeline_id in (
      select pl.id
      from pipeline pl
      join empresa e on pl.empresa_id = e.id
      where e.usuario_id = auth.uid()
         or e.id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
    )
  );

-- UPDATE
drop policy if exists update_persona_pipeline on persona_pipeline;
create policy update_persona_pipeline on persona_pipeline
  for update to authenticated
  using (
    persona_id in (
      select p.id
      from persona p
      join equipos eq on p.equipo_id = eq.id
      join empresa e on eq.empresa_id = e.id
      where e.usuario_id = auth.uid()
         or e.id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
    )
    and
    pipeline_id in (
      select pl.id
      from pipeline pl
      join empresa e on pl.empresa_id = e.id
      where e.usuario_id = auth.uid()
         or e.id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
    )
  )
  with check (
    persona_id in (
      select p.id
      from persona p
      join equipos eq on p.equipo_id = eq.id
      join empresa e on eq.empresa_id = e.id
      where e.usuario_id = auth.uid()
         or e.id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
    )
    and
    pipeline_id in (
      select pl.id
      from pipeline pl
      join empresa e on pl.empresa_id = e.id
      where e.usuario_id = auth.uid()
         or e.id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
    )
  );

-- DELETE
drop policy if exists delete_persona_pipeline on persona_pipeline;
create policy delete_persona_pipeline on persona_pipeline
  for delete to authenticated
  using (
    persona_id in (
      select p.id
      from persona p
      join equipos eq on p.equipo_id = eq.id
      join empresa e on eq.empresa_id = e.id
      where e.usuario_id = auth.uid()
         or e.id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
    )
    and
    pipeline_id in (
      select pl.id
      from pipeline pl
      join empresa e on pl.empresa_id = e.id
      where e.usuario_id = auth.uid()
         or e.id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
    )
  );


  -- ============================================================
-- 1. AGREGAR COLUMNA TAGS A LA TABLA LEAD
-- ============================================================
ALTER TABLE lead ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]';
-- ============================================================
-- 2. CREAR TABLA NOTA_LEAD
-- ============================================================
CREATE TABLE IF NOT EXISTS nota_lead (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES lead(id) ON DELETE CASCADE,
  contenido text NOT NULL,
  creado_por uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
-- Índice para búsquedas por lead
CREATE INDEX IF NOT EXISTS idx_nota_lead_lead_id ON nota_lead(lead_id);
-- ============================================================
-- 3. RLS PARA NOTA_LEAD (compatible con tu estructura)
-- ============================================================
ALTER TABLE nota_lead ENABLE ROW LEVEL SECURITY;
-- Política: usuarios pueden CRUD en notas de leads de su empresa (owner o miembro)
CREATE POLICY nota_lead_rw ON nota_lead
  FOR ALL TO authenticated
  USING (
    lead_id IN (
      SELECT l.id FROM lead l
      WHERE l.empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid())
         OR l.empresa_id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
    )
  )
  WITH CHECK (
    lead_id IN (
      SELECT l.id FROM lead l
      WHERE l.empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid())
         OR l.empresa_id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
    )
  );

  
  alter table nota_lead ADD column if not exists creador_nombre text;


  create table public.presupuesto_pdf (
  id uuid not null default gen_random_uuid(),
  lead_id uuid not null,
  nombre text not null,
  url text not null,
  created_at timestamp with time zone null default now(),
  creado_por uuid null,
  constraint presupuesto_pdf_pkey primary key (id),
  constraint presupuesto_pdf_creado_por_fkey foreign key (creado_por) references auth.users(id),
  constraint presupuesto_pdf_lead_id_fkey foreign key (lead_id) references lead(id) on delete cascade
) tablespace pg_default;

create index idx_presupuesto_pdf_lead_id on public.presupuesto_pdf using btree (lead_id) tablespace pg_default;