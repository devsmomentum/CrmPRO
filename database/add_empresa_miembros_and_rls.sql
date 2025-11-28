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
