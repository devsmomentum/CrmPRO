-- ============================================================
-- FIX INFINITE RECURSION IN RLS POLICIES
-- ============================================================

-- El error "infinite recursion" ocurre porque la política de 'empresa' consulta 'empresa_miembros',
-- y la política de 'empresa_miembros' consulta 'empresa', creando un bucle infinito.
-- Solución: Usar una función SECURITY DEFINER para romper el bucle.

-- 1. Crear función segura para verificar membresía
-- Esta función se ejecuta con privilegios elevados (del creador), saltándose las políticas RLS de empresa_miembros
-- para evitar el bucle, pero filtrando explícitamente por el usuario actual.
CREATE OR REPLACE FUNCTION public.is_empresa_member(_empresa_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM empresa_miembros
    WHERE empresa_id = _empresa_id
    AND usuario_id = auth.uid()
  );
END;
$$;

-- 2. Corregir la política de selección de EMPRESA
DROP POLICY IF EXISTS empresa_select ON empresa;
CREATE POLICY empresa_select ON empresa FOR SELECT TO authenticated USING (
  usuario_id = auth.uid() OR 
  is_empresa_member(id)
);

-- 3. Corregir otras políticas que dependen de empresa para evitar problemas similares
-- PIPELINE
DROP POLICY IF EXISTS pipeline_rw ON pipeline;
CREATE POLICY pipeline_rw ON pipeline FOR ALL TO authenticated USING (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  is_empresa_member(empresa_id)
) WITH CHECK (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  is_empresa_member(empresa_id)
);

-- LEAD
DROP POLICY IF EXISTS lead_rw ON lead;
CREATE POLICY lead_rw ON lead FOR ALL TO authenticated USING (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  is_empresa_member(empresa_id)
) WITH CHECK (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  is_empresa_member(empresa_id)
);

-- EQUIPOS
DROP POLICY IF EXISTS equipos_rw ON equipos;
CREATE POLICY equipos_rw ON equipos FOR ALL TO authenticated USING (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  is_empresa_member(empresa_id)
) WITH CHECK (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  is_empresa_member(empresa_id)
);

-- PANEL
DROP POLICY IF EXISTS panel_rw ON panel;
CREATE POLICY panel_rw ON panel FOR ALL TO authenticated USING (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  is_empresa_member(empresa_id)
) WITH CHECK (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  is_empresa_member(empresa_id)
);

-- 4. Asegurar que empresa_miembros tenga las políticas correctas
-- (Esto ya debería estar bien, pero lo reforzamos)
DROP POLICY IF EXISTS empresa_miembros_owner ON empresa_miembros;
CREATE POLICY empresa_miembros_owner ON empresa_miembros
  FOR ALL TO authenticated
  USING (
    empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid())
  );

DROP POLICY IF EXISTS empresa_miembros_self ON empresa_miembros;
CREATE POLICY empresa_miembros_self ON empresa_miembros
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());

SELECT '✅ RECURSION FIXED' as result;
