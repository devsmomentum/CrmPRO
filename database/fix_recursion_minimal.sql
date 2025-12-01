-- ============================================================
-- FIX MÍNIMO - Solo arreglar recursión infinita en empresa
-- ============================================================

-- Eliminar la política problemática
DROP POLICY IF EXISTS empresa_select ON empresa;

-- Recrear usando EXISTS (rompe el ciclo de recursión)
CREATE POLICY empresa_select ON empresa
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM empresa_miembros 
      WHERE empresa_miembros.empresa_id = empresa.id 
      AND empresa_miembros.usuario_id = auth.uid()
    )
  );

-- Verificar
SELECT '✅ Recursión arreglada - Intenta crear pipeline ahora' as resultado;
