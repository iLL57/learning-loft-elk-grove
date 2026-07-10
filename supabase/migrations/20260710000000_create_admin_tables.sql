-- ── Enrolled Families ──
create table public.enrolled_families (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  parent_first     text not null,
  parent_last      text not null,
  email            text not null,
  phone            text,
  child_name       text not null,
  child_age        text not null,
  enrollment_date  date,
  payment_status   text not null default 'current',
  monthly_rate     numeric(10,2),
  next_payment_due date,
  notes            text,
  submission_id    uuid references public.enrollment_submissions(id)
);

alter table public.enrolled_families enable row level security;

create policy "Authenticated users can manage enrolled families"
  on public.enrolled_families for all
  to authenticated using (true) with check (true);

grant all on public.enrolled_families to service_role;
grant select, insert, update on public.enrolled_families to authenticated;

-- ── Leads / Outreach ──
create table public.leads (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  title       text not null,
  channel     text,
  status      text not null default 'idea',
  description text,
  notes       text
);

alter table public.leads enable row level security;

create policy "Authenticated users can manage leads"
  on public.leads for all
  to authenticated using (true) with check (true);

grant all on public.leads to service_role;
grant select, insert, update on public.leads to authenticated;
