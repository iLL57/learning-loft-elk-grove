-- The public Contact page form (contact.html) has never actually submitted
-- anywhere -- it was front-end only (fake "Sending..." state, no fetch call).
-- This adds the real backend: a table for submit-contact to write to and
-- for admin.html's new Contact Messages tab to read/update.

create table public.contact_submissions (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  first_name   text not null,
  last_name    text not null,
  email        text not null,
  phone        text,
  subject      text,
  message      text not null,
  status       text not null default 'new' check (status in ('new', 'replied'))
);

alter table public.contact_submissions enable row level security;

-- Only admins can read/update contact messages.
create policy "Admins can read contact submissions"
  on public.contact_submissions for select to authenticated using (is_admin());

create policy "Admins can update contact submissions"
  on public.contact_submissions for update to authenticated
  using (is_admin()) with check (is_admin());

-- No direct inserts from the client -- the submit-contact Edge Function
-- uses the service role key.
create policy "No public inserts"
  on public.contact_submissions for insert to anon with check (false);

grant insert, select, update on public.contact_submissions to service_role;
grant select, update on public.contact_submissions to authenticated;
