-- ============================================================
-- RESTAURACIÓN TOTAL BASADA EN SCHEMA.SQL
-- Este script elimina TODO y restaura EXACTAMENTE las políticas
-- que ya funcionaban en tu schema.sql (líneas 475-862)
-- ============================================================

-- ============================================================
-- PASO 1: ELIMINAR TODO LIMPIAMENTE
-- ============================================================

-- EMPRESA
DROP POLICY IF EXISTS empresa_rw ON empresa;
DROP POLICY IF EXISTS empresa_select ON empresa;
DROP POLICY IF EXISTS empresa_update ON empresa;
DROP POLICY IF EXISTS empresa_insert ON empresa;
DROP POLICY IF EXISTS empresa_delete ON empresa;

-- PANEL
DROP POLICY IF EXISTS panel_rw ON panel;

-- PIPELINE
DROP POLICY IF EXISTS pipeline_rw ON pipeline;
DROP POLICY IF EXISTS pipeline_select ON pipeline;
DROP POLICY IF EXISTS pipeline_insert ON pipeline;
DROP POLICY IF EXISTS pipeline_update ON pipeline;
DROP POLICY IF EXISTS pipeline_delete ON pipeline;
DROP POLICY IF EXISTS "Users can view pipelines from their companies" ON pipeline;
DROP POLICY IF EXISTS "Users can insert pipelines for their companies" ON pipeline;
DROP POLICY IF EXISTS "Users can update pipelines from their companies" ON pipeline;
DROP POLICY IF EXISTS "Users can delete pipelines from their companies" ON pipeline;

-- ETAPAS
DROP POLICY IF EXISTS etapas_rw ON etapas;
DROP POLICY IF EXISTS etapas_select ON etapas;
DROP POLICY IF EXISTS etapas_write ON etapas;

-- EQUIPOS
DROP POLICY IF EXISTS equipos_rw ON equipos;
DROP POLICY IF EXISTS equipos_select ON equipos;
DROP POLICY IF EXISTS equipos_write ON equipos;

-- PERSONA
DROP POLICY IF EXISTS persona_rw ON persona;
DROP POLICY IF EXISTS persona_select ON persona;
DROP POLICY IF EXISTS persona_write ON persona;
DROP POLICY IF EXISTS persona_insert_invited ON persona;

-- LEAD
DROP POLICY IF EXISTS lead_rw ON lead;
DROP POLICY IF EXISTS lead_select ON lead;
DROP POLICY IF EXISTS lead_insert ON lead;
DROP POLICY IF EXISTS lead_update ON lead;
DROP POLICY IF EXISTS lead_delete ON lead;

-- PERSONA_PIPELINE
DROP POLICY IF EXISTS select_persona_pipeline ON persona_pipeline;
DROP POLICY IF EXISTS insert_persona_pipeline ON persona_pipeline;
DROP POLICY IF EXISTS update_persona_pipeline ON persona_pipeline;
DROP POLICY IF EXISTS delete_persona_pipeline ON persona_pipeline;
DROP POLICY IF EXISTS persona_pipeline_insert_invited ON persona_pipeline;

-- EMPRESA_MIEMBROS
DROP POLICY IF EXISTS empresa_miembros_owner ON empresa_miembros;
DROP POLICY IF EXISTS empresa_miembros_self ON empresa_miembros;
DROP POLICY IF EXISTS empresa_miembros_select ON empresa_miembros;

-- ============================================================
-- PASO 2: RESTAURAR POLÍTICAS DESDE SCHEMA.SQL (LÍNEAS 475-862)
-- ============================================================

-- EMPRESA_MIEMBROS (líneas 487-501)
create policy empresa_miembros_owner on empresa_miembros
  for all to authenticated
  using (
    empresa_id in (select id from empresa where usuario_id = auth.uid())
  )
  with check (
    empresa_id in (select id from empresa where usuario_id = auth.uid())
  );

create policy empresa_miembros_self on empresa_miembros
  for select to authenticated
  using (usuario_id = auth.uid());


-- PANEL (líneas 505-515)
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


-- EQUIPOS (líneas 519-529)
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


-- PERSONA (líneas 533-553)
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


-- PERSONA_PIPELINE (líneas 560-667)
-- SELECT
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
-- NOTA CRÍTICA: FALTA AGREGAR POLÍTICAS PARA EMPRESA, PIPELINE, LEAD
-- Estas NO están en la sección de miembros de tu schema.sql
-- Por eso NO cargan los datos
-- Las agregaré basadas en el mismo patrón
-- ============================================================

-- EMPRESA - Permitir ver empresas donde eres owner O member
create policy empresa_select on empresa
  for select to authenticated
  using (
    usuario_id = auth.uid()
    or id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
  );

create policy empresa_update on empresa
  for update to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create policy empresa_insert on empresa
  for insert to authenticated
  with check (usuario_id = auth.uid());

create policy empresa_delete on empresa
  for delete to authenticated
  using (usuario_id = auth.uid());


-- PIPELINE - Owner OR member
create policy pipeline_rw on pipeline
  for all to authenticated
  using (
    empresa_id in (select id from empresa where usuario_id = auth.uid())
    or empresa_id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
  )
  with check (
    empresa_id in (select id from empresa where usuario_id = auth.uid())
    or empresa_id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
  );


-- ETAPAS - Owner OR member
create policy etapas_rw on etapas
  for all to authenticated
  using (
    pipeline_id in (
      select p.id
      from pipeline p
      join empresa e on p.empresa_id = e.id
      where e.usuario_id = auth.uid()
         or e.id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
    )
  )
  with check (
    pipeline_id in (
      select p.id
      from pipeline p
      join empresa e on p.empresa_id = e.id
      where e.usuario_id = auth.uid()
         or e.id in (select empresa_id from empresa_miembros where usuario_id = auth.uid())
    )
  );


-- LEAD - Owner OR member
create policy lead_rw on lead
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
-- VERIFICACIÓN FINAL
-- ============================================================
SELECT '
============================================================
RESTAURACIÓN DESDE SCHEMA.SQL COMPLETADA
============================================================

✅ Políticas de schema.sql restauradas
✅ Políticas faltantes agregadas (empresa, pipeline, lead)

AHORA DEBERÍAS PODER:
- Ver tu propia empresa como dueño
- Ver empresas donde eres miembro (si existe en empresa_miembros)

PRÓXIMO PASO:
1. Cierra sesión completamente
2. Vuelve a iniciar sesión
3. Prueba si ahora carga tu CRM

Si funciona como dueño pero NO como invitado:
→ Ejecuta fix_missing_members.sql

============================================================
' as resultado;
