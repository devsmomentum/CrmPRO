-- Función RPC segura para eliminar miembros
-- Esta función se ejecuta con privilegios elevados (SECURITY DEFINER) para evitar problemas de RLS
-- y permitir que los Admins eliminen miembros correctamente.

CREATE OR REPLACE FUNCTION public.delete_team_member(target_email text, target_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Se ejecuta con permisos del creador (admin), saltándose las restricciones RLS del usuario
SET search_path = public
AS $$
DECLARE
  current_user_role text;
  is_owner boolean;
  target_role text;
BEGIN
  -- 1. Obtener rol del usuario que ejecuta la acción
  SELECT role INTO current_user_role
  FROM empresa_miembros
  WHERE empresa_id = target_company_id
  AND usuario_id = auth.uid();

  -- 2. Verificar si es Owner en la tabla empresa
  SELECT EXISTS (
    SELECT 1 FROM empresa WHERE id = target_company_id AND usuario_id = auth.uid()
  ) INTO is_owner;

  -- 3. Obtener el rol del usuario a eliminar (para proteger al Owner)
  SELECT role INTO target_role
  FROM empresa_miembros
  WHERE empresa_id = target_company_id
  AND email = target_email;

  -- 4. Validaciones de seguridad
  IF target_role = 'owner' THEN
    RAISE EXCEPTION 'No se puede eliminar al propietario de la empresa.';
  END IF;

  IF NOT is_owner AND current_user_role != 'admin' THEN
    RAISE EXCEPTION 'No tienes permisos para eliminar miembros.';
  END IF;

  -- 5. Ejecutar eliminación en ambas tablas
  
  -- Eliminar de empresa_miembros
  DELETE FROM empresa_miembros
  WHERE empresa_id = target_company_id
  AND email = target_email;

  -- Eliminar de persona (buscando por equipos de esa empresa)
  DELETE FROM persona
  WHERE equipo_id IN (SELECT id FROM equipos WHERE empresa_id = target_company_id)
  AND email = target_email;

END;
$$;
