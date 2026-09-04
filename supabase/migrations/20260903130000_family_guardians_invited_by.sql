-- Guardians can now invite a co-guardian to their own family from the
-- parent portal (not just admins). Record who sent each invite so the
-- admin Families tab has an audit trail of school- vs parent-added
-- guardians.

alter table public.family_guardians
  add column invited_by uuid references auth.users(id) on delete set null;
