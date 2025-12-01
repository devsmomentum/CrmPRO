-- ============================================================
-- UPDATE ACCEPT INVITATION TO USE PERMISSION ROLE
-- ============================================================

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
  -- AQUI USAMOS EL ROL DE LA INVITACION O 'viewer' POR DEFECTO
  insert into empresa_miembros (empresa_id, usuario_id, email, role)
  values (
    invite_record.empresa_id,
    current_user_id,
    invite_record.invited_email,
    COALESCE(invite_record.permission_role, 'viewer')
  )
  ON CONFLICT (empresa_id, usuario_id) DO UPDATE
  SET role = EXCLUDED.role; -- Actualizar rol si ya existe

  -- 4. Actualizar la invitación
  update equipo_invitaciones 
  set status = 'accepted', 
      responded_at = now(), 
      invited_usuario_id = current_user_id 
  where id = invite_record.id;

  return json_build_object('member_id', new_member_id);
end;
$$ language plpgsql security definer;
