-- The parent portal schema migration granted only SELECT on families /
-- family_guardians to `authenticated`. The admin Families tab also creates
-- and edits family records directly from the browser (RLS still restricts
-- this to is_admin()), so it needs INSERT/UPDATE table privileges too.
-- Guardian links are still written only by the parent-invite Edge Function
-- (service role), so family_guardians stays SELECT-only for authenticated.

grant insert, update on public.families to authenticated;
