ALTER TABLE public.lead
ADD COLUMN IF NOT EXISTS last_message text;

-- Optional: Create an index if we plan to search specifically on this column, 
-- but usually full text search needs tsvector. For display, this is fine.
