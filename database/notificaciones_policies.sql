-- ============================================================
-- NOTIFICACIONES: Habilitar RLS y políticas de acceso
-- Permite a usuarios autenticados leer y marcar como leídas
-- solo sus propias notificaciones (según `usuario_email`).
-- ============================================================

-- Habilitar RLS
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

-- SELECT: solo notificaciones del propio email
DROP POLICY IF EXISTS notificaciones_select_self ON notificaciones;
CREATE POLICY notificaciones_select_self ON notificaciones
  FOR SELECT TO authenticated
  USING (usuario_email = (auth.jwt() ->> 'email'));

-- UPDATE: permitir marcar como leídas las propias
DROP POLICY IF EXISTS notificaciones_update_self ON notificaciones;
CREATE POLICY notificaciones_update_self ON notificaciones
  FOR UPDATE TO authenticated
  USING (usuario_email = (auth.jwt() ->> 'email'))
  WITH CHECK (usuario_email = (auth.jwt() ->> 'email'));

-- Opcional: índices recomendados para rendimiento del contador
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_email ON notificaciones(usuario_email);
CREATE INDEX IF NOT EXISTS idx_notificaciones_read ON notificaciones(read);
CREATE INDEX IF NOT EXISTS idx_notificaciones_type ON notificaciones(type);
