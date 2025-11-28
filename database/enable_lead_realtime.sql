-- Habilitar Realtime para la tabla lead
-- Este script agrega la tabla lead a la publicación de Realtime de Supabase

-- Primero, verificar que la tabla tenga REPLICA IDENTITY
ALTER TABLE lead REPLICA IDENTITY FULL;

-- Agregar la tabla a la publicación de Realtime
-- La publicación 'supabase_realtime' es la que usa Supabase por defecto
ALTER PUBLICATION supabase_realtime ADD TABLE lead;
