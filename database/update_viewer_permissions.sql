-- 1. Asegurar que la función helper exista
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

-- 2. Permitir a viewers crear leads
DROP POLICY IF EXISTS lead_insert ON lead;
CREATE POLICY lead_insert ON lead FOR INSERT TO authenticated WITH CHECK (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  get_empresa_role(empresa_id) IN ('admin', 'viewer')
);

-- 3. Permitir a viewers actualizar leads (mover etapas, editar info)
DROP POLICY IF EXISTS lead_update ON lead;
CREATE POLICY lead_update ON lead FOR UPDATE TO authenticated USING (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  get_empresa_role(empresa_id) IN ('admin', 'viewer')
) WITH CHECK (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  get_empresa_role(empresa_id) IN ('admin', 'viewer')
);

-- 4. Permitir a viewers crear etapas
DROP POLICY IF EXISTS etapas_insert ON etapas;
CREATE POLICY etapas_insert ON etapas FOR INSERT TO authenticated WITH CHECK (
  pipeline_id IN (
    SELECT p.id FROM pipeline p
    LEFT JOIN empresa e ON p.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR get_empresa_role(e.id) IN ('admin', 'viewer')
  )
);

-- 5. Permitir a viewers actualizar etapas (cambiar nombre, color, orden)
DROP POLICY IF EXISTS etapas_update ON etapas;
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
