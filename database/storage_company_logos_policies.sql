-- Policies for Supabase Storage bucket: company-logos
-- Allows authenticated users to upload and manage their own files in this bucket

BEGIN;

-- Ensure RLS is enabled on storage.objects (it is by default in Supabase)
-- Create simple policies scoped to the bucket 'company-logos'

DROP POLICY IF EXISTS storage_company_logos_insert ON storage.objects;
DROP POLICY IF EXISTS storage_company_logos_update ON storage.objects;
DROP POLICY IF EXISTS storage_company_logos_delete ON storage.objects;
DROP POLICY IF EXISTS storage_company_logos_select ON storage.objects;

-- SELECT: allow everyone to read if bucket is public; otherwise authenticated users
CREATE POLICY storage_company_logos_select ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'company-logos');

-- INSERT: allow authenticated users to upload into company-logos
CREATE POLICY storage_company_logos_insert ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'company-logos' AND owner = auth.uid());

-- UPDATE: allow owners to update their own files in company-logos
CREATE POLICY storage_company_logos_update ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'company-logos' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'company-logos' AND owner = auth.uid());

-- DELETE: allow owners to delete their own files in company-logos
CREATE POLICY storage_company_logos_delete ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'company-logos' AND owner = auth.uid());

COMMIT;
