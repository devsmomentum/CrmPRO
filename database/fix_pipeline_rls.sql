-- Fix RLS Policies for Pipeline Table
-- Este script corrige los permisos de Row Level Security para permitir
-- que los usuarios autenticados puedan crear, leer, actualizar y eliminar pipelines

-- Habilitar RLS en la tabla pipeline (si no está habilitado)
ALTER TABLE pipeline ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen (para evitar conflictos)
DROP POLICY IF EXISTS "Users can view pipelines from their companies" ON pipeline;
DROP POLICY IF EXISTS "Users can insert pipelines for their companies" ON pipeline;
DROP POLICY IF EXISTS "Users can update pipelines from their companies" ON pipeline;
DROP POLICY IF EXISTS "Users can delete pipelines from their companies" ON pipeline;

-- Política para SELECT: Los usuarios pueden ver pipelines de sus empresas
CREATE POLICY "Users can view pipelines from their companies"
ON pipeline
FOR SELECT
TO authenticated
USING (
  empresa_id IN (
    -- Empresas donde soy dueño
    SELECT e.id 
    FROM empresa e
    WHERE e.usuario_id = auth.uid()
    
    UNION
    
    -- Empresas donde soy miembro (via persona -> equipos -> empresa)
    SELECT eq.empresa_id
    FROM persona p
    JOIN equipos eq ON eq.id = p.equipo_id
    WHERE p.usuario_id = auth.uid()
  )
);

-- Política para INSERT: Los usuarios pueden crear pipelines para sus empresas
CREATE POLICY "Users can insert pipelines for their companies"
ON pipeline
FOR INSERT
TO authenticated
WITH CHECK (
  empresa_id IN (
    -- Empresas donde soy dueño
    SELECT e.id 
    FROM empresa e
    WHERE e.usuario_id = auth.uid()
    
    UNION
    
    -- Empresas donde soy miembro (via persona -> equipos -> empresa)
    SELECT eq.empresa_id
    FROM persona p
    JOIN equipos eq ON eq.id = p.equipo_id
    WHERE p.usuario_id = auth.uid()
  )
);

-- Política para UPDATE: Los usuarios pueden actualizar pipelines de sus empresas
CREATE POLICY "Users can update pipelines from their companies"
ON pipeline
FOR UPDATE
TO authenticated
USING (
  empresa_id IN (
    -- Empresas donde soy dueño
    SELECT e.id 
    FROM empresa e
    WHERE e.usuario_id = auth.uid()
    
    UNION
    
    -- Empresas donde soy miembro (via persona -> equipos -> empresa)
    SELECT eq.empresa_id
    FROM persona p
    JOIN equipos eq ON eq.id = p.equipo_id
    WHERE p.usuario_id = auth.uid()
  )
)
WITH CHECK (
  empresa_id IN (
    -- Empresas donde soy dueño
    SELECT e.id 
    FROM empresa e
    WHERE e.usuario_id = auth.uid()
    
    UNION
    
    -- Empresas donde soy miembro (via persona -> equipos -> empresa)
    SELECT eq.empresa_id
    FROM persona p
    JOIN equipos eq ON eq.id = p.equipo_id
    WHERE p.usuario_id = auth.uid()
  )
);

-- Política para DELETE: Los usuarios pueden eliminar pipelines de sus empresas
CREATE POLICY "Users can delete pipelines from their companies"
ON pipeline
FOR DELETE
TO authenticated
USING (
  empresa_id IN (
    -- Empresas donde soy dueño
    SELECT e.id 
    FROM empresa e
    WHERE e.usuario_id = auth.uid()
    
    UNION
    
    -- Empresas donde soy miembro (via persona -> equipos -> empresa)
    SELECT eq.empresa_id
    FROM persona p
    JOIN equipos eq ON eq.id = p.equipo_id
    WHERE p.usuario_id = auth.uid()
  )
);
