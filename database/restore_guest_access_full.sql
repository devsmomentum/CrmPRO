-- ============================================================
-- RESTORE GUEST ACCESS FUNCTIONALITY (COMPLETE FIX)
-- ============================================================

-- 1. Ensure unique constraint exists on empresa_miembros to prevent duplicates
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'empresa_miembros_empresa_user_unique') THEN
        ALTER TABLE empresa_miembros ADD CONSTRAINT empresa_miembros_empresa_user_unique UNIQUE (empresa_id, usuario_id);
    END IF;
END $$;

-- 2. EMPRESA (Ver la empresa invitada)
DROP POLICY IF EXISTS empresa_select ON empresa;
CREATE POLICY empresa_select ON empresa FOR SELECT TO authenticated USING (
  usuario_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM empresa_miembros WHERE empresa_id = empresa.id AND usuario_id = auth.uid())
);

-- 3. PIPELINE (Ver los pipelines)
DROP POLICY IF EXISTS pipeline_rw ON pipeline;
CREATE POLICY pipeline_rw ON pipeline FOR ALL TO authenticated USING (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  empresa_id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
) WITH CHECK (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  empresa_id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
);

-- 4. ETAPAS (Ver las etapas del pipeline)
DROP POLICY IF EXISTS etapas_rw ON etapas;
CREATE POLICY etapas_rw ON etapas FOR ALL TO authenticated USING (
  pipeline_id IN (
    SELECT p.id FROM pipeline p
    LEFT JOIN empresa e ON p.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR
    e.id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
  )
) WITH CHECK (
  pipeline_id IN (
    SELECT p.id FROM pipeline p
    LEFT JOIN empresa e ON p.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR
    e.id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
  )
);

-- 5. LEAD (Ver los leads/clientes)
-- Drop old/conflicting policies if they exist
DROP POLICY IF EXISTS lead_rw ON lead;
DROP POLICY IF EXISTS lead_all_access ON lead;
DROP POLICY IF EXISTS lead_all_member ON lead;

CREATE POLICY lead_rw ON lead FOR ALL TO authenticated USING (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  empresa_id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
) WITH CHECK (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  empresa_id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
);

-- 6. EQUIPOS (Ver los equipos)
DROP POLICY IF EXISTS equipos_rw ON equipos;
CREATE POLICY equipos_rw ON equipos FOR ALL TO authenticated USING (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  empresa_id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
) WITH CHECK (
  empresa_id IN (SELECT id FROM empresa WHERE usuario_id = auth.uid()) OR
  empresa_id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
);

-- 7. PERSONA (Ver los miembros del equipo)
DROP POLICY IF EXISTS persona_rw ON persona;
CREATE POLICY persona_rw ON persona FOR ALL TO authenticated USING (
  equipo_id IN (
    SELECT eq.id FROM equipos eq
    JOIN empresa e ON eq.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR
    e.id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
  )
) WITH CHECK (
  equipo_id IN (
    SELECT eq.id FROM equipos eq
    JOIN empresa e ON eq.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR
    e.id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
  )
);

-- 8. PERSONA_PIPELINE (Asignaciones)
DROP POLICY IF EXISTS select_persona_pipeline ON persona_pipeline;
CREATE POLICY select_persona_pipeline ON persona_pipeline FOR SELECT TO authenticated USING (
  persona_id IN (
    SELECT p.id FROM persona p
    JOIN equipos eq ON p.equipo_id = eq.id
    JOIN empresa e ON eq.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR e.id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
  ) AND
  pipeline_id IN (
    SELECT pl.id FROM pipeline pl
    JOIN empresa e ON pl.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR e.id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
  )
);

DROP POLICY IF EXISTS insert_persona_pipeline ON persona_pipeline;
CREATE POLICY insert_persona_pipeline ON persona_pipeline FOR INSERT TO authenticated WITH CHECK (
  persona_id IN (
    SELECT p.id FROM persona p
    JOIN equipos eq ON p.equipo_id = eq.id
    JOIN empresa e ON eq.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR e.id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
  ) AND
  pipeline_id IN (
    SELECT pl.id FROM pipeline pl
    JOIN empresa e ON pl.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR e.id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
  )
);

DROP POLICY IF EXISTS update_persona_pipeline ON persona_pipeline;
CREATE POLICY update_persona_pipeline ON persona_pipeline FOR UPDATE TO authenticated USING (
  persona_id IN (
    SELECT p.id FROM persona p
    JOIN equipos eq ON p.equipo_id = eq.id
    JOIN empresa e ON eq.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR e.id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
  ) AND
  pipeline_id IN (
    SELECT pl.id FROM pipeline pl
    JOIN empresa e ON pl.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR e.id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
  )
) WITH CHECK (
  persona_id IN (
    SELECT p.id FROM persona p
    JOIN equipos eq ON p.equipo_id = eq.id
    JOIN empresa e ON eq.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR e.id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
  ) AND
  pipeline_id IN (
    SELECT pl.id FROM pipeline pl
    JOIN empresa e ON pl.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR e.id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
  )
);

DROP POLICY IF EXISTS delete_persona_pipeline ON persona_pipeline;
CREATE POLICY delete_persona_pipeline ON persona_pipeline FOR DELETE TO authenticated USING (
  persona_id IN (
    SELECT p.id FROM persona p
    JOIN equipos eq ON p.equipo_id = eq.id
    JOIN empresa e ON eq.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR e.id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
  ) AND
  pipeline_id IN (
    SELECT pl.id FROM pipeline pl
    JOIN empresa e ON pl.empresa_id = e.id
    WHERE e.usuario_id = auth.uid() OR e.id IN (SELECT empresa_id FROM empresa_miembros WHERE usuario_id = auth.uid())
  )
);


-- 9. Populate empresa_miembros for existing accepted invitations
DO $$
BEGIN
    -- Try to insert using permission_role if it exists, otherwise default to 'viewer'
    BEGIN
        EXECUTE '
            INSERT INTO empresa_miembros (empresa_id, usuario_id, email, role, created_at)
            SELECT 
              ei.empresa_id,
              ei.invited_usuario_id,
              ei.invited_email,
              COALESCE(ei.permission_role, ''viewer''),
              ei.responded_at
            FROM equipo_invitaciones ei
            LEFT JOIN empresa_miembros em 
              ON ei.empresa_id = em.empresa_id 
              AND ei.invited_email = em.email
            WHERE ei.status = ''accepted''
              AND ei.invited_usuario_id IS NOT NULL
              AND em.id IS NULL
            ON CONFLICT (empresa_id, usuario_id) DO NOTHING
        ';
    EXCEPTION WHEN OTHERS THEN
        -- Fallback if permission_role column does not exist
        INSERT INTO empresa_miembros (empresa_id, usuario_id, email, role, created_at)
        SELECT 
          ei.empresa_id,
          ei.invited_usuario_id,
          ei.invited_email,
          'viewer',
          ei.responded_at
        FROM equipo_invitaciones ei
        LEFT JOIN empresa_miembros em 
          ON ei.empresa_id = em.empresa_id 
          AND ei.invited_email = em.email
        WHERE ei.status = 'accepted'
          AND ei.invited_usuario_id IS NOT NULL
          AND em.id IS NULL
        ON CONFLICT (empresa_id, usuario_id) DO NOTHING;
    END;
END $$;

-- 10. Update accept_invitation function to automatically add to empresa_miembros
create or replace function accept_invitation(invite_token text, current_user_id uuid)
returns json as $$
declare
  invite_record record;
  new_member_id uuid;
begin
  -- 1. Buscar la invitación
  select * into invite_record from equipo_invitaciones where token = invite_token;

  if invite_record is null then
    raise exception 'Invitación inválida o expirada';
  end if;

  if invite_record.status != 'pending' then
     raise exception 'Esta invitación ya ha sido procesada';
  end if;

  -- 2. Insertar en persona (miembros del equipo)
  insert into persona (nombre, email, titulo_trabajo, equipo_id, usuario_id)
  values (
    invite_record.invited_nombre, 
    invite_record.invited_email, 
    invite_record.invited_titulo_trabajo, 
    invite_record.equipo_id, 
    current_user_id
  )
  returning id into new_member_id;

  -- 3. Insertar en empresa_miembros (para acceso a nivel empresa)
  insert into empresa_miembros (empresa_id, usuario_id, email, role)
  values (
    invite_record.empresa_id,
    current_user_id,
    invite_record.invited_email,
    'viewer' -- Default role
  )
  ON CONFLICT (empresa_id, usuario_id) DO NOTHING;

  -- 4. Actualizar la invitación
  update equipo_invitaciones 
  set status = 'accepted', 
      responded_at = now(), 
      invited_usuario_id = current_user_id 
  where id = invite_record.id;

  return json_build_object('member_id', new_member_id);
end;
$$ language plpgsql security definer;
