-- Policy to allow deletion of messages
-- Users can delete messages if they belong to the same company as the lead

-- Drop existing delete policy if it exists (to be safe/idempotent)
DROP POLICY IF EXISTS "Enable delete for team members" ON "public"."mensajes";

CREATE POLICY "Enable delete for team members" ON "public"."mensajes"
AS PERMISSIVE FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM lead l
    JOIN empresa_miembros em ON l.empresa_id = em.empresa_id
    WHERE l.id = mensajes.lead_id
    AND em.usuario_id = auth.uid()
  )
);
