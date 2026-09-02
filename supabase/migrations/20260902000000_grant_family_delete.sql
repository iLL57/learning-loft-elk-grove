-- Admin Families tab needs to delete a family (e.g. a duplicate created by
-- a double-submit) and to revoke an individual guardian's portal access.
-- RLS still gates both to is_admin(); this just adds the table privilege.
--
-- FK behaviour on family delete: enrolled_students.family_id is ON DELETE
-- SET NULL (students become "unassigned", recoverable), family_guardians
-- is ON DELETE CASCADE (guardian links removed; the auth users remain).

grant delete on public.families to authenticated;
grant delete on public.family_guardians to authenticated;
