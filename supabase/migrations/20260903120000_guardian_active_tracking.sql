-- The admin Families tab needs to show whether an invited guardian has
-- actually signed in yet ("Active" vs "Invited"). family_guardians.accepted_at
-- already exists but nothing ever set it.
--
-- The portal can't UPDATE family_guardians directly (authenticated has no
-- write grant there, by design), so this SECURITY DEFINER function does it:
-- the portal calls it once the guardian is signed in and it stamps
-- accepted_at on that guardian's own rows.

create or replace function public.mark_guardian_active()
  returns void
  language sql
  security definer
  set search_path = public
as $$
  update public.family_guardians
    set accepted_at = now()
    where user_id = auth.uid() and accepted_at is null;
$$;

revoke all on function public.mark_guardian_active() from public;
grant execute on function public.mark_guardian_active() to authenticated;
