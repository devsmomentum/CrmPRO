-- Add permission_role column to equipo_invitaciones if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'equipo_invitaciones'
        AND column_name = 'permission_role'
    ) THEN
        ALTER TABLE equipo_invitaciones ADD COLUMN permission_role text DEFAULT 'viewer';
    END IF;
END $$;
