-- ============================================================
-- INSPECT SCHEMA AND POLICIES
-- Run this script in the Supabase SQL Editor to see the current state
-- ============================================================

-- 1. Check columns in 'equipo_invitaciones'
SELECT 
    table_name, 
    column_name, 
    data_type, 
    column_default
FROM information_schema.columns
WHERE table_name = 'equipo_invitaciones'
ORDER BY ordinal_position;

-- 2. Check columns in 'empresa_miembros' (to verify target role column)
SELECT 
    table_name, 
    column_name, 
    data_type
FROM information_schema.columns
WHERE table_name = 'empresa_miembros'
ORDER BY ordinal_position;

-- 3. List all RLS Policies for relevant tables
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN ('equipo_invitaciones', 'empresa_miembros', 'empresa', 'equipos')
ORDER BY tablename, policyname;

-- 4. Check the last 5 invitations to see what data is actually being stored
-- (This helps verify if permission_role and pipeline_ids are being saved)
SELECT 
    id, 
    invited_email, 
    invited_titulo_trabajo, 
    permission_role, 
    pipeline_ids, 
    status, 
    created_at
FROM equipo_invitaciones
ORDER BY created_at DESC
LIMIT 5;
