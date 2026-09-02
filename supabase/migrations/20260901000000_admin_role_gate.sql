-- Parent Portal foundation, part 1 of 3: the admin role gate.
--
-- Until now every row in every admin table was readable/writable by any
-- authenticated user (`to authenticated using (true)`). That was fine
-- while the ONLY authenticated users were admins. The parent portal adds
-- a second class of authenticated user (enrolled guardians) to the same
-- Supabase project, so "authenticated" can no longer mean "admin".
--
-- This migration:
--   1. Adds a user_roles table + is_admin() helper.
--   2. Seeds every existing auth user as an admin (currently they all are).
--   3. Rewrites every existing admin RLS policy to require is_admin().
--
-- Parent-facing tables and their guardian-scoped policies come in part 2.

-- ── 1. Roles ──
create table public.user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

-- SECURITY DEFINER so the function can read user_roles regardless of the
-- caller's own RLS view of that table (avoids a policy-recursion trap).
create or replace function public.is_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

-- Admins may read the roster (so admin.html can show/manage it); only the
-- service role writes to it (via the admin-invite-user Edge Function).
create policy "Admins can read roles"
  on public.user_roles for select to authenticated using (is_admin());

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

-- ── 2. Seed existing users as admins ──
-- Every current auth user was created as an admin, so grandfather them all.
-- New parent accounts created after this migration get NO user_roles row.
insert into public.user_roles (user_id)
  select id from auth.users
  on conflict (user_id) do nothing;

-- ── 3. Retrofit existing admin policies ──

-- enrollment_submissions
drop policy if exists "Admins can read submissions" on public.enrollment_submissions;
create policy "Admins can read submissions"
  on public.enrollment_submissions for select to authenticated using (is_admin());

drop policy if exists "Authenticated users can update submissions" on public.enrollment_submissions;
create policy "Admins can update submissions"
  on public.enrollment_submissions for update to authenticated
  using (is_admin()) with check (is_admin());

-- enrolled_students (policy name is historical, table was renamed from enrolled_families)
drop policy if exists "Authenticated users can manage enrolled families" on public.enrolled_students;
create policy "Admins can manage enrolled students"
  on public.enrolled_students for all to authenticated
  using (is_admin()) with check (is_admin());

-- leads
drop policy if exists "Authenticated users can manage leads" on public.leads;
create policy "Admins can manage leads"
  on public.leads for all to authenticated
  using (is_admin()) with check (is_admin());

-- submission_students
drop policy if exists "Admins can read submission students" on public.submission_students;
create policy "Admins can read submission students"
  on public.submission_students for select to authenticated using (is_admin());
