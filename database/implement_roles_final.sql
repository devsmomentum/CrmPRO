-- ============================================================
-- IMPLEMENT ROLE BASED ACCESS CONTROL (RBAC)
-- Roles: 'admin', 'viewer'
-- Owner: Full Access
-- Admin: Can manage Leads, Stages, Team Assignments. CANNOT Create Pipelines, CANNOT Invite Members.
-- Viewer: Read Only.
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
-- Owner: Full Access
-- Admin: Full Access (Insert, Update, Delete)
-- Viewer: Select Only
DROP POLICY IF EXISTS lead_rw ON lead;

CREATE POLICY lead_select ON lead FOR SELECT TO authenticated USING (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  get_empresa_role(empresa_id) IS NOT NULL
);

CREATE POLICY lead_insert ON lead FOR INSERT TO authenticated WITH CHECK (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  get_empresa_role(empresa_id) = 'admin'
);

CREATE POLICY lead_update ON lead FOR UPDATE TO authenticated USING (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  get_empresa_role(empresa_id) = 'admin'
) WITH CHECK (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  get_empresa_role(empresa_id) = 'admin'
);

CREATE POLICY lead_delete ON lead FOR DELETE TO authenticated USING (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  get_empresa_role(empresa_id) = 'admin'
);


-- 3. PIPELINE Policies
-- Owner: Full Access
-- Admin: Select, Update (Rename). CANNOT Insert (Create), CANNOT Delete.
-- Viewer: Select Only
DROP POLICY IF EXISTS pipeline_rw ON pipeline;

CREATE POLICY pipeline_select ON pipeline FOR SELECT TO authenticated USING (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  get_empresa_role(empresa_id) IS NOT NULL
);

CREATE POLICY pipeline_insert ON pipeline FOR INSERT TO authenticated WITH CHECK (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid())
  -- Admin CANNOT insert
);

CREATE POLICY pipeline_update ON pipeline FOR UPDATE TO authenticated USING (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  get_empresa_role(empresa_id) = 'admin'
) WITH CHECK (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  get_empresa_role(empresa_id) = 'admin'
);

CREATE POLICY pipeline_delete ON pipeline FOR DELETE TO authenticated USING (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid())
  -- Admin CANNOT delete (to be safe)
);


-- 4. ETAPAS Policies (Stages)
-- Owner: Full Access
-- Admin: Full Access (Manage workflow)
-- Viewer: Select Only
DROP POLICY IF EXISTS etapas_rw ON etapas;

CREATE POLICY etapas_select ON etapas FOR SELECT TO authenticated USING (
  pipeline_id IN (
    SELECT p.id FROM pipeline p
    LEFT JOIN empresa e ON p.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR get_empresa_role(e.id) IS NOT NULL
  )
);

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


-- 5. EQUIPO_INVITACIONES Policies
-- Owner: Full Access
-- Admin: Select Only (Cannot Invite)
-- Viewer: Select Only (Maybe none?)
DROP POLICY IF EXISTS equipo_invitaciones_insert ON equipo_invitaciones;
DROP POLICY IF EXISTS equipo_invitaciones_select ON equipo_invitaciones;
DROP POLICY IF EXISTS equipo_invitaciones_update_owner ON equipo_invitaciones;

CREATE POLICY equipo_invitaciones_select ON equipo_invitaciones FOR SELECT TO authenticated USING (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  get_empresa_role(empresa_id) IS NOT NULL OR
  invited_email = (auth.jwt() ->> 'email')
);

CREATE POLICY equipo_invitaciones_insert ON equipo_invitaciones FOR INSERT TO authenticated WITH CHECK (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid())
  -- Admin CANNOT invite
);

CREATE POLICY equipo_invitaciones_update_owner ON equipo_invitaciones FOR UPDATE TO authenticated USING (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid())
);


-- 6. PERSONA Policies (Team Members)
-- Owner: Full Access
-- Admin: Full Access (Can assign people to teams)
-- Viewer: Select Only
DROP POLICY IF EXISTS persona_rw ON persona;

CREATE POLICY persona_select ON persona FOR SELECT TO authenticated USING (
  equipo_id IN (
    SELECT eq.id FROM equipos eq
    JOIN empresa e ON eq.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR get_empresa_role(e.id) IS NOT NULL
  )
);

CREATE POLICY persona_insert ON persona FOR INSERT TO authenticated WITH CHECK (
  equipo_id IN (
    SELECT eq.id FROM equipos eq
    JOIN empresa e ON eq.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR get_empresa_role(e.id) = 'admin'
  )
);

CREATE POLICY persona_update ON persona FOR UPDATE TO authenticated USING (
  equipo_id IN (
    SELECT eq.id FROM equipos eq
    JOIN empresa e ON eq.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR get_empresa_role(e.id) = 'admin'
  )
);

CREATE POLICY persona_delete ON persona FOR DELETE TO authenticated USING (
  equipo_id IN (
    SELECT eq.id FROM equipos eq
    JOIN empresa e ON eq.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR get_empresa_role(e.id) = 'admin'
  )
);

SELECT '✅ RBAC IMPLEMENTED: Admin (No Pipeline Create, No Invite), Viewer (Read Only)' as result;
