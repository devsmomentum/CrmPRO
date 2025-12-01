-- ============================================================
-- FIX LEAD PERMISSIONS FINAL
-- Drop ALL potential policies to ensure clean slate
-- ============================================================

-- 1. Helper function (ensure it exists)
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

-- 2. Drop ALL policies on lead
DROP POLICY IF EXISTS lead_rw ON lead;
DROP POLICY IF EXISTS lead_all_access ON lead;
DROP POLICY IF EXISTS lead_all_member ON lead;
DROP POLICY IF EXISTS lead_select ON lead;
DROP POLICY IF EXISTS lead_insert ON lead;
DROP POLICY IF EXISTS lead_update ON lead;
DROP POLICY IF EXISTS lead_delete ON lead;

-- 3. Recreate policies with correct permissions

-- SELECT: Owner OR Member (Admin/Viewer)
CREATE POLICY lead_select ON lead FOR SELECT TO authenticated USING (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  get_empresa_role(empresa_id) IS NOT NULL
);

-- INSERT: Owner OR Admin OR Viewer
CREATE POLICY lead_insert ON lead FOR INSERT TO authenticated WITH CHECK (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  get_empresa_role(empresa_id) IN ('admin', 'viewer')
);

-- UPDATE: Owner OR Admin OR Viewer
CREATE POLICY lead_update ON lead FOR UPDATE TO authenticated USING (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  get_empresa_role(empresa_id) IN ('admin', 'viewer')
) WITH CHECK (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  get_empresa_role(empresa_id) IN ('admin', 'viewer')
);

-- DELETE: Owner OR Admin ONLY (Viewers cannot delete)
CREATE POLICY lead_delete ON lead FOR DELETE TO authenticated USING (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  get_empresa_role(empresa_id) = 'admin'
);

-- ============================================================
-- FIX ETAPAS PERMISSIONS (Just in case)
-- ============================================================

DROP POLICY IF EXISTS etapas_rw ON etapas;
DROP POLICY IF EXISTS etapas_select ON etapas;
DROP POLICY IF EXISTS etapas_insert ON etapas;
DROP POLICY IF EXISTS etapas_update ON etapas;
DROP POLICY IF EXISTS etapas_delete ON etapas;

-- SELECT: Owner OR Member
CREATE POLICY etapas_select ON etapas FOR SELECT TO authenticated USING (
  pipeline_id IN (
    SELECT p.id FROM pipeline p
    LEFT JOIN empresa e ON p.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR get_empresa_role(e.id) IS NOT NULL
  )
);

-- INSERT: Owner OR Admin OR Viewer
CREATE POLICY etapas_insert ON etapas FOR INSERT TO authenticated WITH CHECK (
  pipeline_id IN (
    SELECT p.id FROM pipeline p
    LEFT JOIN empresa e ON p.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR get_empresa_role(e.id) IN ('admin', 'viewer')
  )
);

-- UPDATE: Owner OR Admin OR Viewer
CREATE POLICY etapas_update ON etapas FOR UPDATE TO authenticated USING (
  pipeline_id IN (
    SELECT p.id FROM pipeline p
    LEFT JOIN empresa e ON p.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR get_empresa_role(e.id) IN ('admin', 'viewer')
  )
) WITH CHECK (
  pipeline_id IN (
    SELECT p.id FROM pipeline p
    LEFT JOIN empresa e ON p.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR get_empresa_role(e.id) IN ('admin', 'viewer')
  )
);

-- DELETE: Owner OR Admin ONLY
CREATE POLICY etapas_delete ON etapas FOR DELETE TO authenticated USING (
  pipeline_id IN (
    SELECT p.id FROM pipeline p
    LEFT JOIN empresa e ON p.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR get_empresa_role(e.id) = 'admin'
  )
);
