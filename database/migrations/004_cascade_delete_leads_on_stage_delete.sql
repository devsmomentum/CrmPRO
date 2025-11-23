ALTER TABLE lead
DROP CONSTRAINT lead_etapa_id_fkey,
ADD CONSTRAINT lead_etapa_id_fkey
FOREIGN KEY (etapa_id)
REFERENCES etapas(id)
ON DELETE CASCADE;
