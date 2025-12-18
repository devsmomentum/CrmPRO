-- Add ubicacion column to lead table
ALTER TABLE lead ADD COLUMN IF NOT EXISTS ubicacion text;
