-- Replace the enrollment interest form's field set to match the new
-- Pre-Enrollment Interest Form (2026-2027 school year).

alter table public.enrollment_submissions
  add column parent_name text,
  add column days_interest text,
  add column day_preference text,
  add column tuition_exchange text,
  add column charter_program text;

-- Backfill parent_name from the old split name columns for any existing rows
update public.enrollment_submissions
  set parent_name = trim(both ' ' from coalesce(parent_first, '') || ' ' || coalesce(parent_last, ''))
  where parent_name is null;

alter table public.enrollment_submissions
  alter column parent_name set not null,
  drop column parent_first,
  drop column parent_last,
  drop column how_long,
  drop column interest;
