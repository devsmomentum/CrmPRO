-- ==============================================================================
-- SOLUCIÓN DEFINITIVA PARA PERMISOS DE ADMIN
-- ==============================================================================
-- Este script permite que los Admins eliminen miembros sin causar "infinite recursion".
-- Funciona igual que el permiso de Owner, pero adaptado para Admin.

-- 1. Función de seguridad (Rompe el bucle de recursión)
-- Verifica si el usuario actual es admin sin ser bloqueado por las políticas de la tabla.
CREATE OR REPLACE FUNCTION public.is_admin_safe(_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM empresa_miembros
    WHERE empresa_id = _empresa_id
    AND usuario_id = auth.uid()
    AND role = 'admin'
  );
$$;

-- 2. Política de Eliminación para Admins
-- Permite borrar si eres Admin, pero protege al Owner.
DROP POLICY IF EXISTS empresa_miembros_admin_delete ON empresa_miembros;

CREATE POLICY empresa_miembros_admin_delete ON empresa_miembros
  FOR DELETE TO authenticated
  USING (
    -- Usa la función segura para verificar si soy admin
    is_admin_safe(empresa_id) IS TRUE
    -- Y asegura que no estemos borrando al dueño
    AND role != 'owner'
  );
