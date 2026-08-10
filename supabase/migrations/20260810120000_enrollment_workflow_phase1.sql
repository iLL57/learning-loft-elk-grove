-- Phase 1 of the full enrollment workflow (application -> review ->
-- package sent / waitlisted / rejected -> enrolled).
--
-- 1. enrollment_submissions: child_name/child_age become legacy/nullable
--    now that new applications record each child as its own row in
--    submission_students instead of a comma-joined string.
-- 2. New submission_students table: one row per child per application.
-- 3. enrolled_students: unify parent_first/parent_last into a single
--    parent_name (matching enrollment_submissions, table is still
--    empty so this is a zero-cost cleanup), and add tracking fields
--    for the one-time enrollment package (signature + initial payment),
--    kept separate from payment_status which continues to track
--    ongoing monthly billing once a student is fully enrolled.

alter table public.enrollment_submissions
  alter column child_name drop not null,
  alter column child_age drop not null;

create table public.submission_students (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  submission_id uuid not null references public.enrollment_submissions(id) on delete cascade,
  student_name  text not null,
  grade_level   text not null check (grade_level in ('TK','K','1','2','3','4','5','6'))
);

alter table public.submission_students enable row level security;

create policy "Admins can read submission students"
  on public.submission_students for select to authenticated using (true);

create policy "No public inserts on submission students"
  on public.submission_students for insert to anon with check (false);

grant insert, select on public.submission_students to service_role;
grant select on public.submission_students to authenticated;

alter table public.enrolled_students
  add column parent_name text;

update public.enrolled_students
  set parent_name = trim(both ' ' from coalesce(parent_first, '') || ' ' || coalesce(parent_last, ''))
  where parent_name is null;

alter table public.enrolled_students
  alter column parent_name set not null,
  drop column parent_first,
  drop column parent_last;

alter table public.enrolled_students
  add column documents_signed boolean not null default false,
  add column initial_payment_received boolean not null default false;
