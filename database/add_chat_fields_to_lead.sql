-- Agregar columnas para control de estado del chat en la tabla lead
ALTER TABLE lead 
ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS last_message_sender TEXT DEFAULT 'team'; -- 'lead' o 'team'

-- Indice para ordenar rápido
CREATE INDEX IF NOT EXISTS idx_lead_chat_sort ON lead (last_message_sender DESC, last_message_at DESC);
