-- ==============================================================================
-- SOLUCIÓN ROBUSTA PARA PERMISOS DE ADMIN
-- ==============================================================================

-- 1. Función de seguridad mejorada
-- Usamos PL/PGSQL y cubrimos mayúsculas/minúsculas en el rol.
CREATE OR REPLACE FUNCTION public.is_admin_safe(_empresa_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Importante: Se ejecuta con permisos de sistema
SET search_path = public
AS $$
BEGIN
  -- Verifica si el usuario actual tiene rol admin en la empresa dada
  RETURN EXISTS (
    SELECT 1 FROM empresa_miembros
    WHERE empresa_id = _empresa_id
    AND usuario_id = auth.uid()
    AND lower(role) = 'admin' -- Convertimos a minúsculas para asegurar coincidencia
  );
END;
$$;

-- 2. Asegurar permisos de ejecución para la función
GRANT EXECUTE ON FUNCTION public.is_admin_safe TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_safe TO service_role;

-- 3. Política de Eliminación para Admins
DROP POLICY IF EXISTS empresa_miembros_admin_delete ON empresa_miembros;

CREATE POLICY empresa_miembros_admin_delete ON empresa_miembros
  FOR DELETE TO authenticated
  USING (
    -- Si la función devuelve TRUE, permite el borrado
    is_admin_safe(empresa_id) IS TRUE
    -- Protegemos al Owner de ser borrado
    AND (role IS NULL OR lower(role) != 'owner')
  );
