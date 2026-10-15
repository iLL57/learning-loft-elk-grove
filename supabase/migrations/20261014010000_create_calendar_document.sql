-- A single PDF calendar (important dates, closures) shown on the parent
-- portal. Unlike `documents` (a growing list of files), this is always
-- exactly one file — uploading a new one from the admin dashboard replaces
-- it outright, so there's no "which calendar is current" ambiguity. Kept
-- as its own table/bucket rather than folded into `documents` so the
-- portal Calendar page and its storage policies stay simple (no
-- published/category filtering, no list).

insert into storage.buckets (id, name, public)
  values ('calendar', 'calendar', false)
  on conflict (id) do nothing;

create table public.calendar_document (
  id            uuid primary key default gen_random_uuid(),
  updated_at    timestamptz not null default now(),
  storage_path  text not null unique,
  file_name     text not null,
  file_size     bigint,
  mime_type     text
);

alter table public.calendar_document enable row level security;

create policy "Admins manage calendar document"
  on public.calendar_document for all to authenticated
  using (is_admin()) with check (is_admin());

-- Any signed-in portal user (guardian or admin) can read it — not scoped
-- to a family, same reasoning as photo_albums/documents.
create policy "Authenticated users read calendar document"
  on public.calendar_document for select to authenticated
  using (true);

grant select, insert, update, delete on public.calendar_document to authenticated;
grant all on public.calendar_document to service_role;

create policy "Admins manage calendar files"
  on storage.objects for all to authenticated
  using (bucket_id = 'calendar' and is_admin())
  with check (bucket_id = 'calendar' and is_admin());

create policy "Authenticated users read calendar files"
  on storage.objects for select to authenticated
  using (bucket_id = 'calendar');
