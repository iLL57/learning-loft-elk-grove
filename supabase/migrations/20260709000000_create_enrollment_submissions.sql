create table public.enrollment_submissions (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  parent_first text not null,
  parent_last  text not null,
  email        text not null,
  phone        text,
  child_name   text not null,
  child_age    text not null,
  how_long     text,
  hear_about   text,
  interest     text,
  message      text,
  status       text not null default 'new'
);

-- Only authenticated users (admins) can read submissions
alter table public.enrollment_submissions enable row level security;

create policy "Admins can read submissions"
  on public.enrollment_submissions
  for select
  to authenticated
  using (true);

-- No direct inserts from the client — Edge Function uses service role
create policy "No public inserts"
  on public.enrollment_submissions
  for insert
  to anon
  with check (false);

-- Grant service_role full access (bypasses RLS but still needs table privileges)
grant insert, select, update on public.enrollment_submissions to service_role;

-- Grant authenticated users (admin) read and update access
grant select, update on public.enrollment_submissions to authenticated;

create policy "Authenticated users can update submissions"
  on public.enrollment_submissions
  for update
  to authenticated
  using (true)
  with check (true);
