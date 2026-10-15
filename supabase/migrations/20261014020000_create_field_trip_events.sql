-- Field Trips & Special Events: a list of items for the parent portal, each
-- either a link (e.g. a Google Form sign-up) or an uploaded file (e.g. a
-- flyer/permission slip PDF) — covers field trips, the Trunk-or-Treat
-- sign-up, special curriculum days, etc. Modeled on photo_albums'
-- month-or-title pattern (exactly one of two columns set) and documents'
-- private-storage-plus-signed-URL pattern (for the file case).

insert into storage.buckets (id, name, public)
  values ('field_trips', 'field_trips', false)
  on conflict (id) do nothing;

create table public.field_trip_events (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  title         text not null,
  description   text,
  event_date    date,  -- optional; purely informational/sort order, not a reminder system
  external_url  text,
  storage_path  text unique,
  file_name     text,
  file_size     bigint,
  mime_type     text,
  published     boolean not null default true,
  constraint field_trip_events_link_or_file_check check (
    (external_url is not null and storage_path is null)
    or (external_url is null and storage_path is not null)
  )
);

alter table public.field_trip_events enable row level security;

create policy "Admins manage field trip events"
  on public.field_trip_events for all to authenticated
  using (is_admin()) with check (is_admin());

create policy "Authenticated users read published field trip events"
  on public.field_trip_events for select to authenticated
  using (published = true);

grant select, insert, update, delete on public.field_trip_events to authenticated;
grant all on public.field_trip_events to service_role;

-- Storage access mirrors documents: admins get full bucket access; any
-- authenticated user can read a file ONLY for a published row, enforced
-- by joining back to the table rather than trusting the bucket alone.
create policy "Admins manage field trip files"
  on storage.objects for all to authenticated
  using (bucket_id = 'field_trips' and is_admin())
  with check (bucket_id = 'field_trips' and is_admin());

create policy "Authenticated users read published field trip files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'field_trips'
    and exists (
      select 1 from public.field_trip_events f
      where f.storage_path = storage.objects.name and f.published = true
    )
  );
