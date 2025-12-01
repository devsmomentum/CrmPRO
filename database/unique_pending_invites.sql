-- Enforce no duplicate pending invitations per company and email
create unique index if not exists equipo_invitaciones_unique_pending_email
  on public.equipo_invitaciones (empresa_id, lower(invited_email))
  where status = 'pending';
