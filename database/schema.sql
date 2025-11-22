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


