-- ============================================================
-- IMPLEMENT ADMIN ROLE FUNCTIONALITY
-- ============================================================

-- 1. Helper function to get current user's role in a company
CREATE OR REPLACE FUNCTION public.get_empresa_role(_empresa_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role text;
BEGIN
  SELECT role INTO _role
  FROM empresa_miembros
  WHERE empresa_id = _empresa_id
  AND usuario_id = auth.uid();
  
  RETURN _role;
END;
$$;

-- 2. LEAD Policies
-- Drop existing policies that might be too permissive
DROP POLICY IF EXISTS lead_rw ON lead;
DROP POLICY IF EXISTS lead_all_access ON lead;
DROP POLICY IF EXISTS lead_all_member ON lead;
DROP POLICY IF EXISTS lead_select ON lead;
DROP POLICY IF EXISTS lead_insert ON lead;
DROP POLICY IF EXISTS lead_update ON lead;
DROP POLICY IF EXISTS lead_delete ON lead;

-- Viewer & Admin can SEE leads
CREATE POLICY lead_select ON lead FOR SELECT TO authenticated USING (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  get_empresa_role(empresa_id) IS NOT NULL
);

-- Only Admin (and Owner) can INSERT leads
CREATE POLICY lead_insert ON lead FOR INSERT TO authenticated WITH CHECK (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  get_empresa_role(empresa_id) = 'admin'
);

-- Only Admin (and Owner) can UPDATE leads (move, edit)
CREATE POLICY lead_update ON lead FOR UPDATE TO authenticated USING (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  get_empresa_role(empresa_id) = 'admin'
) WITH CHECK (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  get_empresa_role(empresa_id) = 'admin'
);

-- Only Admin (and Owner) can DELETE leads
CREATE POLICY lead_delete ON lead FOR DELETE TO authenticated USING (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  get_empresa_role(empresa_id) = 'admin'
);


-- 3. PIPELINE Policies
DROP POLICY IF EXISTS pipeline_rw ON pipeline;
DROP POLICY IF EXISTS pipeline_select ON pipeline;
DROP POLICY IF EXISTS pipeline_insert ON pipeline;
DROP POLICY IF EXISTS pipeline_update ON pipeline;
DROP POLICY IF EXISTS pipeline_delete ON pipeline;

-- Viewer & Admin can SEE pipelines
CREATE POLICY pipeline_select ON pipeline FOR SELECT TO authenticated USING (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  get_empresa_role(empresa_id) IS NOT NULL
);

-- Admin can UPDATE pipelines (e.g. rename)
CREATE POLICY pipeline_update ON pipeline FOR UPDATE TO authenticated USING (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  get_empresa_role(empresa_id) = 'admin'
) WITH CHECK (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  get_empresa_role(empresa_id) = 'admin'
);

-- Admin CANNOT create or delete pipelines (Owner only, as per typical requirements, but can be adjusted)
CREATE POLICY pipeline_insert ON pipeline FOR INSERT TO authenticated WITH CHECK (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid())
);

CREATE POLICY pipeline_delete ON pipeline FOR DELETE TO authenticated USING (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid())
);


-- 4. ETAPAS Policies (Stages)
DROP POLICY IF EXISTS etapas_rw ON etapas;
DROP POLICY IF EXISTS etapas_select ON etapas;
DROP POLICY IF EXISTS etapas_insert ON etapas;
DROP POLICY IF EXISTS etapas_update ON etapas;
DROP POLICY IF EXISTS etapas_delete ON etapas;

-- Viewer & Admin can SEE stages
CREATE POLICY etapas_select ON etapas FOR SELECT TO authenticated USING (
  pipeline_id IN (
    SELECT p.id FROM pipeline p
    LEFT JOIN empresa e ON p.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR get_empresa_role(e.id) IS NOT NULL
  )
);

-- Admin can MANAGE stages (Insert, Update, Delete)
CREATE POLICY etapas_insert ON etapas FOR INSERT TO authenticated WITH CHECK (
  pipeline_id IN (
    SELECT p.id FROM pipeline p
    LEFT JOIN empresa e ON p.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR get_empresa_role(e.id) = 'admin'
  )
);

CREATE POLICY etapas_update ON etapas FOR UPDATE TO authenticated USING (
  pipeline_id IN (
    SELECT p.id FROM pipeline p
    LEFT JOIN empresa e ON p.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR get_empresa_role(e.id) = 'admin'
  )
);

CREATE POLICY etapas_delete ON etapas FOR DELETE TO authenticated USING (
  pipeline_id IN (
    SELECT p.id FROM pipeline p
    LEFT JOIN empresa e ON p.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR get_empresa_role(e.id) = 'admin'
  )
);


-- 5. EQUIPOS Policies (Teams)
DROP POLICY IF EXISTS equipos_rw ON equipos;
DROP POLICY IF EXISTS equipos_select ON equipos;
DROP POLICY IF EXISTS equipos_all ON equipos;

-- Viewer & Admin can SEE teams
CREATE POLICY equipos_select ON equipos FOR SELECT TO authenticated USING (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  get_empresa_role(empresa_id) IS NOT NULL
);

-- Admin can MANAGE teams
CREATE POLICY equipos_all ON equipos FOR ALL TO authenticated USING (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  get_empresa_role(empresa_id) = 'admin'
) WITH CHECK (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  get_empresa_role(empresa_id) = 'admin'
);


-- 6. PERSONA Policies (Team Members)
DROP POLICY IF EXISTS persona_rw ON persona;
DROP POLICY IF EXISTS persona_select ON persona;
DROP POLICY IF EXISTS persona_all ON persona;

-- Viewer & Admin can SEE members
CREATE POLICY persona_select ON persona FOR SELECT TO authenticated USING (
  equipo_id IN (
    SELECT eq.id FROM equipos eq
    JOIN empresa e ON eq.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR get_empresa_role(e.id) IS NOT NULL
  )
);

-- Admin can MANAGE members
CREATE POLICY persona_all ON persona FOR ALL TO authenticated USING (
  equipo_id IN (
    SELECT eq.id FROM equipos eq
    JOIN empresa e ON eq.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR get_empresa_role(e.id) = 'admin'
  )
) WITH CHECK (
  equipo_id IN (
    SELECT eq.id FROM equipos eq
    JOIN empresa e ON eq.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR get_empresa_role(e.id) = 'admin'
  )
);
