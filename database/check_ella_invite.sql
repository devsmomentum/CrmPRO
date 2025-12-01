-- Check the latest invitation for 'ella'
SELECT 
    id, 
    invited_email, 
    invited_nombre,
    permission_role, 
    pipeline_ids, 
    status, 
    created_at
FROM equipo_invitaciones
WHERE invited_nombre = 'ella'
ORDER BY created_at DESC
LIMIT 1;
