-- Parent Portal foundation, part 2 of 3: family + guardian schema.
--
-- A "family" is the unit that enrolls. enrolled_students rows hang off a
-- family; guardians (Supabase auth users) are linked to a family via
-- family_guardians and that link is what grants a parent portal access.
-- Identity is the link row, NOT an email match on the student record, so
-- a mistyped student email can't silently hide a child and two guardians
-- can each have their own login for the same family.

-- ── families ──
create table public.families (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  family_name           text not null,
  primary_guardian_name text,
  primary_email         text,
  primary_phone         text,
  address               text,
  emergency_contacts    text,
  notes                 text,
  -- the application this family was enrolled from, when there is one
  source_submission_id  uuid references public.enrollment_submissions(id) on delete set null
);

alter table public.families enable row level security;

create policy "Admins manage families"
  on public.families for all to authenticated
  using (is_admin()) with check (is_admin());

-- ── family_guardians ──
create table public.family_guardians (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  family_id    uuid not null references public.families(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  email        text not null,
  name         text,
  relationship text,
  invited_at   timestamptz,
  accepted_at  timestamptz,
  unique (family_id, user_id)
);

alter table public.family_guardians enable row level security;

create policy "Admins manage guardians"
  on public.family_guardians for all to authenticated
  using (is_admin()) with check (is_admin());

-- SECURITY DEFINER: the migration owner bypasses RLS, so a policy that
-- calls this to check "which families is the caller a guardian of" won't
-- recurse back through family_guardians' own RLS.
create or replace function public.my_family_ids()
  returns setof uuid
  language sql
  stable
  security definer
  set search_path = public
as $$
  select family_id from public.family_guardians where user_id = auth.uid();
$$;

revoke all on function public.my_family_ids() from public;
grant execute on function public.my_family_ids() to authenticated, service_role;

create policy "Guardians read own family"
  on public.families for select to authenticated
  using (id in (select public.my_family_ids()));

create policy "Guardians read own family's guardians"
  on public.family_guardians for select to authenticated
  using (family_id in (select public.my_family_ids()));

grant select on public.families to authenticated;
grant select on public.family_guardians to authenticated;
grant all on public.families to service_role;
grant all on public.family_guardians to service_role;

-- ── enrolled_students: attach to a family, track program day ──
alter table public.enrolled_students
  add column family_id   uuid references public.families(id) on delete set null,
  add column program_day  text check (program_day in ('Tue', 'Thu', 'Tue & Thu'));

create index enrolled_students_family_id_idx on public.enrolled_students (family_id);

-- email / student_age were required back when a student row carried its
-- own contact info and the interest form collected an age. The family now
-- owns contact info and the age field is vestigial (Send Package writes
-- ""), so neither should block a family that predates an application.
alter table public.enrolled_students
  alter column email drop not null,
  alter column student_age drop not null;

-- Admin access already covered by "Admins can manage enrolled students"
-- (part 1). This adds read-only access for a student's own guardians.
create policy "Guardians read own students"
  on public.enrolled_students for select to authenticated
  using (family_id in (select public.my_family_ids()));
