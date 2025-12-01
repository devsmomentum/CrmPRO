
-- ============================================================
-- ACTUALIZACION DE POLÍTICAS RLS PARA MIEMBROS DE EQUIPO
-- Basado en tablas existentes: persona, equipos, empresa
-- ============================================================

-- 1. EMPRESA
-- El dueño ve su empresa.
-- Los miembros de equipos ven la empresa a la que pertenecen.
drop policy if exists empresa_select on empresa;
create policy empresa_select on empresa
  for select to authenticated
  using (
    usuario_id = auth.uid() -- Dueño
    OR
    id in ( -- Miembro de algún equipo de la empresa
      select eq.empresa_id
      from equipos eq
      join persona p on eq.id = p.equipo_id
      where p.usuario_id = auth.uid()
    )
  );

-- 2. PANEL
-- Acceso para dueños y miembros de equipos de la empresa
drop policy if exists panel_rw on panel;
create policy panel_rw on panel
  for all to authenticated
  using (
    empresa_id in (select id from empresa where usuario_id = auth.uid())
    OR
    empresa_id in (
      select eq.empresa_id
      from equipos eq
      join persona p on eq.id = p.equipo_id
      where p.usuario_id = auth.uid()
    )
  )
  with check (
    empresa_id in (select id from empresa where usuario_id = auth.uid())
    OR
    empresa_id in (
      select eq.empresa_id
      from equipos eq
      join persona p on eq.id = p.equipo_id
      where p.usuario_id = auth.uid()
    )
  );

-- 3. EQUIPOS
-- Acceso para dueños y miembros de la empresa
drop policy if exists equipos_rw on equipos;
create policy equipos_rw on equipos
  for all to authenticated
  using (
    empresa_id in (select id from empresa where usuario_id = auth.uid())
    OR
    empresa_id in (
      select eq.empresa_id
      from equipos eq
      join persona p on eq.id = p.equipo_id
      where p.usuario_id = auth.uid()
    )
  )
  with check (
    empresa_id in (select id from empresa where usuario_id = auth.uid())
    OR
    empresa_id in (
      select eq.empresa_id
      from equipos eq
      join persona p on eq.id = p.equipo_id
      where p.usuario_id = auth.uid()
    )
  );

-- 4. PERSONA (Miembros)
-- Ver a otros miembros si estás en la misma empresa
drop policy if exists persona_rw on persona;
create policy persona_rw on persona
  for all to authenticated
  using (
    equipo_id in (
      select eq.id
      from equipos eq
      join empresa e on eq.empresa_id = e.id
      where e.usuario_id = auth.uid() -- Dueño
         OR e.id in ( -- Miembro de la empresa
            select eq2.empresa_id
            from equipos eq2
            join persona p2 on eq2.id = p2.equipo_id
            where p2.usuario_id = auth.uid()
         )
    )
  )
  with check (
    equipo_id in (
      select eq.id
      from equipos eq
      join empresa e on eq.empresa_id = e.id
      where e.usuario_id = auth.uid()
         OR e.id in (
            select eq2.empresa_id
            from equipos eq2
            join persona p2 on eq2.id = p2.equipo_id
            where p2.usuario_id = auth.uid()
         )
    )
  );

-- 5. PIPELINE
-- Acceso a pipelines de la empresa
drop policy if exists pipeline_rw on pipeline;
create policy pipeline_rw on pipeline
  for all to authenticated
  using (
    empresa_id in (select id from empresa where usuario_id = auth.uid())
    OR
    empresa_id in (
      select eq.empresa_id
      from equipos eq
      join persona p on eq.id = p.equipo_id
      where p.usuario_id = auth.uid()
    )
  )
  with check (
    empresa_id in (select id from empresa where usuario_id = auth.uid())
    OR
    empresa_id in (
      select eq.empresa_id
      from equipos eq
      join persona p on eq.id = p.equipo_id
      where p.usuario_id = auth.uid()
    )
  );

-- 6. PERSONA_PIPELINE (Relación M:N)
-- Acceso si eres dueño o miembro de la empresa
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
         OR e.id in (
            select eq2.empresa_id
            from equipos eq2
            join persona p2 on eq2.id = p2.equipo_id
            where p2.usuario_id = auth.uid()
         )
    )
  );

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
         OR e.id in (
            select eq2.empresa_id
            from equipos eq2
            join persona p2 on eq2.id = p2.equipo_id
            where p2.usuario_id = auth.uid()
         )
    )
  );

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
         OR e.id in (
            select eq2.empresa_id
            from equipos eq2
            join persona p2 on eq2.id = p2.equipo_id
            where p2.usuario_id = auth.uid()
         )
    )
  )
  with check (
    persona_id in (
      select p.id
      from persona p
      join equipos eq on p.equipo_id = eq.id
      join empresa e on eq.empresa_id = e.id
      where e.usuario_id = auth.uid()
         OR e.id in (
            select eq2.empresa_id
            from equipos eq2
            join persona p2 on eq2.id = p2.equipo_id
            where p2.usuario_id = auth.uid()
         )
    )
  );

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
         OR e.id in (
            select eq2.empresa_id
            from equipos eq2
            join persona p2 on eq2.id = p2.equipo_id
            where p2.usuario_id = auth.uid()
         )
    )
  );
