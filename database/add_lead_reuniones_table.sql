-- ============================================================
-- Tabla: lead_reuniones (reuniones agendadas para un lead)
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_reuniones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES lead(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  titulo text NOT NULL,
  fecha timestamptz NOT NULL,
  duracion_minutos integer NOT NULL DEFAULT 30,
  notas text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_reuniones_lead_id ON lead_reuniones(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_reuniones_empresa_id ON lead_reuniones(empresa_id);

-- ============================================================
-- Tabla: lead_reunion_participantes (participantes normalizados)
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_reunion_participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reunion_id uuid NOT NULL REFERENCES lead_reuniones(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  tipo text CHECK (tipo IN ('internal', 'external')) DEFAULT 'external',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_reunion_participantes_reunion_id ON lead_reunion_participantes(reunion_id);

-- Trigger simple para updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lead_reuniones_updated_at ON lead_reuniones;
CREATE TRIGGER trg_lead_reuniones_updated_at
  BEFORE UPDATE ON lead_reuniones
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_lead_reunion_participantes_updated_at ON lead_reunion_participantes;
CREATE TRIGGER trg_lead_reunion_participantes_updated_at
  BEFORE UPDATE ON lead_reunion_participantes
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
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

-- ============================================================
-- Row Level Security para lead_reunion_participantes
-- ============================================================
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
