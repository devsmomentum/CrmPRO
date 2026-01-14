-- ============================================================
-- RESTAURAR POLÍTICAS RLS FUNCIONALES
-- Este script restaura las políticas que funcionaban ANTES
-- ============================================================

-- 1) EMPRESA_MIEMBROS - Políticas básicas
DROP POLICY IF EXISTS empresa_miembros_owner ON empresa_miembros;
CREATE POLICY empresa_miembros_owner ON empresa_miembros
  FOR ALL TO authenticated
  USING (
    empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid())
  )
  WITH CHECK (
    empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid())
  );

DROP POLICY IF EXISTS empresa_miembros_self ON empresa_miembros;
CREATE POLICY empresa_miembros_self ON empresa_miembros
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());

-- 2) EMPRESA - Permitir ver empresas donde eres owner O member
DROP POLICY IF EXISTS empresa_rw ON empresa;
DROP POLICY IF EXISTS empresa_select ON empresa;
CREATE POLICY empresa_rw ON empresa
  FOR ALL TO authenticated
  USING (
    usuario_id = auth.uid()
    OR id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
  )
  WITH CHECK (
    usuario_id = auth.uid()
  );

-- 3) PANEL - Owner OR member
DROP POLICY IF EXISTS panel_rw ON panel;
CREATE POLICY panel_rw ON panel
  FOR ALL TO authenticated
  USING (
    panel.empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid())
    OR panel.empresa_id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
  )
  WITH CHECK (
    panel.empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid())
    OR panel.empresa_id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
  );

-- 4) EQUIPOS - Owner OR member
DROP POLICY IF EXISTS equipos_rw ON equipos;
CREATE POLICY equipos_rw ON equipos
  FOR ALL TO authenticated
  USING (
    equipos.empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid())
    OR equipos.empresa_id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
  )
  WITH CHECK (
    equipos.empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid())
    OR equipos.empresa_id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
  );

-- 5) PERSONA - Owner OR member via equipos -> empresa
DROP POLICY IF EXISTS persona_rw ON persona;
CREATE POLICY persona_rw ON persona
  FOR ALL TO authenticated
  USING (
    persona.equipo_id IN (
      SELECT eq.id
      FROM equipos eq
      JOIN empresa e ON eq.empresa_id = e.id
      WHERE e.usuario_id = auth.uid()
         OR e.id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
    )
  )
  WITH CHECK (
    persona.equipo_id IN (
      SELECT eq.id
      FROM equipos eq
      JOIN empresa e ON eq.empresa_id = e.id
      WHERE e.usuario_id = auth.uid()
         OR e.id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
    )
  );

-- 6) PIPELINE - Owner OR member
DROP POLICY IF EXISTS pipeline_rw ON pipeline;
DROP POLICY IF EXISTS pipeline_select ON pipeline;
DROP POLICY IF EXISTS pipeline_insert ON pipeline;
DROP POLICY IF EXISTS pipeline_update ON pipeline;
DROP POLICY IF EXISTS pipeline_delete ON pipeline;
DROP POLICY IF EXISTS "Users can view pipelines from their companies" ON pipeline;

CREATE POLICY pipeline_rw ON pipeline
  FOR ALL TO authenticated
  USING (
    empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid())
    OR empresa_id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
  )
  WITH CHECK (
    empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid())
    OR empresa_id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
  );

-- 7) ETAPAS - Owner OR member
DROP POLICY IF EXISTS etapas_rw ON etapas;
DROP POLICY IF EXISTS etapas_select ON etapas;
DROP POLICY IF EXISTS etapas_write ON etapas;

CREATE POLICY etapas_rw ON etapas
  FOR ALL TO authenticated
  USING (
    pipeline_id IN (
      SELECT pl.id
      FROM pipeline pl
      JOIN empresa e ON pl.empresa_id = e.id
      WHERE e.usuario_id = auth.uid()
         OR e.id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
    )
  )
  WITH CHECK (
    pipeline_id IN (
      SELECT pl.id
      FROM pipeline pl
      JOIN empresa e ON pl.empresa_id = e.id
      WHERE e.usuario_id = auth.uid()
         OR e.id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
    )
  );

-- 8) LEAD - Owner OR member
DROP POLICY IF EXISTS lead_rw ON lead;
DROP POLICY IF EXISTS lead_select ON lead;
DROP POLICY IF EXISTS lead_insert ON lead;
DROP POLICY IF EXISTS lead_update ON lead;
DROP POLICY IF EXISTS lead_delete ON lead;

CREATE POLICY lead_rw ON lead
  FOR ALL TO authenticated
  USING (
    empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid())
    OR empresa_id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
  )
  WITH CHECK (
    empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid())
    OR empresa_id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
  );

-- 9) PERSONA_PIPELINE - Owner OR member (ambos lados)
-- SELECT
DROP POLICY IF EXISTS select_persona_pipeline ON persona_pipeline;
CREATE POLICY select_persona_pipeline ON persona_pipeline
  FOR SELECT TO authenticated
  USING (
    persona_id IN (
      SELECT p.id
      FROM persona p
      JOIN equipos eq ON p.equipo_id = eq.id
      JOIN empresa e ON eq.empresa_id = e.id
      WHERE e.usuario_id = auth.uid()
         OR e.id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
    )
    AND
    pipeline_id IN (
      SELECT pl.id
      FROM pipeline pl
      JOIN empresa e ON pl.empresa_id = e.id
      WHERE e.usuario_id = auth.uid()
         OR e.id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
    )
  );

-- INSERT
DROP POLICY IF EXISTS insert_persona_pipeline ON persona_pipeline;
CREATE POLICY insert_persona_pipeline ON persona_pipeline
  FOR INSERT TO authenticated
  WITH CHECK (
    persona_id IN (
      SELECT p.id
      FROM persona p
      JOIN equipos eq ON p.equipo_id = eq.id
      JOIN empresa e ON eq.empresa_id = e.id
      WHERE e.usuario_id = auth.uid()
         OR e.id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
    )
    AND
    pipeline_id IN (
      SELECT pl.id
      FROM pipeline pl
      JOIN empresa e ON pl.empresa_id = e.id
      WHERE e.usuario_id = auth.uid()
         OR e.id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
    )
  );

-- UPDATE
DROP POLICY IF EXISTS update_persona_pipeline ON persona_pipeline;
CREATE POLICY update_persona_pipeline ON persona_pipeline
  FOR UPDATE TO authenticated
  USING (
    persona_id IN (
      SELECT p.id
      FROM persona p
      JOIN equipos eq ON p.equipo_id = eq.id
      JOIN empresa e ON eq.empresa_id = e.id
      WHERE e.usuario_id = auth.uid()
         OR e.id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
    )
    AND
    pipeline_id IN (
      SELECT pl.id
      FROM pipeline pl
      JOIN empresa e ON pl.empresa_id = e.id
      WHERE e.usuario_id = auth.uid()
         OR e.id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
    )
  )
  WITH CHECK (
    persona_id IN (
      SELECT p.id
      FROM persona p
      JOIN equipos eq ON p.equipo_id = eq.id
      JOIN empresa e ON eq.empresa_id = e.id
      WHERE e.usuario_id = auth.uid()
         OR e.id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
    )
    AND
    pipeline_id IN (
      SELECT pl.id
      FROM pipeline pl
      JOIN empresa e ON pl.empresa_id = e.id
      WHERE e.usuario_id = auth.uid()
         OR e.id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
    )
  );

-- DELETE
DROP POLICY IF EXISTS delete_persona_pipeline ON persona_pipeline;
CREATE POLICY delete_persona_pipeline ON persona_pipeline
  FOR DELETE TO authenticated
  USING (
    persona_id IN (
      SELECT p.id
      FROM persona p
      JOIN equipos eq ON p.equipo_id = eq.id
      JOIN empresa e ON eq.empresa_id = e.id
      WHERE e.usuario_id = auth.uid()
         OR e.id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
    )
    AND
    pipeline_id IN (
      SELECT pl.id
      FROM pipeline pl
      JOIN empresa e ON pl.empresa_id = e.id
      WHERE e.usuario_id = auth.uid()
         OR e.id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
    )
  );

-- ============================================================
-- FIN DE LA RESTAURACIÓN
-- ============================================================

-- EXTRA: Restaurar políticas para NOTIFICACIONES
-- (permite que el usuario autenticado lea/actualice sus propias filas)
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notificaciones_select_self ON notificaciones;
CREATE POLICY notificaciones_select_self ON notificaciones
  FOR SELECT TO authenticated
  USING (usuario_email = (auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS notificaciones_update_self ON notificaciones;
CREATE POLICY notificaciones_update_self ON notificaciones
  FOR UPDATE TO authenticated
  USING (usuario_email = (auth.jwt() ->> 'email'))
  WITH CHECK (usuario_email = (auth.jwt() ->> 'email'));

-- EXTRA: Restaurar políticas para LEAD_REUNIONES
ALTER TABLE lead_reuniones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_reuniones_select ON lead_reuniones;
CREATE POLICY lead_reuniones_select ON lead_reuniones
  FOR SELECT TO authenticated
  USING (
    empresa_id IN (
      SELECT id FROM empresa WHERE usuario_id = auth.uid()
      UNION
      SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS lead_reuniones_insert ON lead_reuniones;
CREATE POLICY lead_reuniones_insert ON lead_reuniones
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id IN (
      SELECT id FROM empresa WHERE usuario_id = auth.uid()
      UNION
      SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS lead_reuniones_update ON lead_reuniones;
CREATE POLICY lead_reuniones_update ON lead_reuniones
  FOR UPDATE TO authenticated
  USING (
    empresa_id IN (
      SELECT id FROM empresa WHERE usuario_id = auth.uid()
      UNION
      SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    empresa_id IN (
      SELECT id FROM empresa WHERE usuario_id = auth.uid()
      UNION
      SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS lead_reuniones_delete ON lead_reuniones;
CREATE POLICY lead_reuniones_delete ON lead_reuniones
  FOR DELETE TO authenticated
  USING (
    empresa_id IN (
      SELECT id FROM empresa WHERE usuario_id = auth.uid()
      UNION
      SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid()
    )
  );

-- EXTRA: Restaurar políticas para LEAD_REUNION_PARTICIPANTES
ALTER TABLE lead_reunion_participantes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_reunion_participantes_select ON lead_reunion_participantes;
CREATE POLICY lead_reunion_participantes_select ON lead_reunion_participantes
  FOR SELECT TO authenticated
  USING (
    reunion_id IN (
      SELECT lr.id
      FROM lead_reuniones lr
      WHERE lr.empresa_id IN (
        SELECT id FROM empresa WHERE usuario_id = auth.uid()
        UNION
        SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS lead_reunion_participantes_insert ON lead_reunion_participantes;
CREATE POLICY lead_reunion_participantes_insert ON lead_reunion_participantes
  FOR INSERT TO authenticated
  WITH CHECK (
    reunion_id IN (
      SELECT lr.id
      FROM lead_reuniones lr
      WHERE lr.empresa_id IN (
        SELECT id FROM empresa WHERE usuario_id = auth.uid()
        UNION
        SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS lead_reunion_participantes_update ON lead_reunion_participantes;
CREATE POLICY lead_reunion_participantes_update ON lead_reunion_participantes
  FOR UPDATE TO authenticated
  USING (
    reunion_id IN (
      SELECT lr.id
      FROM lead_reuniones lr
      WHERE lr.empresa_id IN (
        SELECT id FROM empresa WHERE usuario_id = auth.uid()
        UNION
        SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    reunion_id IN (
      SELECT lr.id
      FROM lead_reuniones lr
      WHERE lr.empresa_id IN (
        SELECT id FROM empresa WHERE usuario_id = auth.uid()
        UNION
        SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS lead_reunion_participantes_delete ON lead_reunion_participantes;
CREATE POLICY lead_reunion_participantes_delete ON lead_reunion_participantes
  FOR DELETE TO authenticated
  USING (
    reunion_id IN (
      SELECT lr.id
      FROM lead_reuniones lr
      WHERE lr.empresa_id IN (
        SELECT id FROM empresa WHERE usuario_id = auth.uid()
        UNION
        SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid()
      )
    )
  );
