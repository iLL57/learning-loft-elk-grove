-- Admin-uploaded documents (parent handbook, policies, forms) shown on the
-- parent portal. Unlike photo albums (which just link to Google Drive),
-- these are real files the admin uploads through the dashboard, stored in
-- a private Supabase Storage bucket and served via short-lived signed URLs
-- -- so, unlike the photo albums' "anyone with the link," access is
-- actually enforced by portal login the whole way through.
--
-- Not scoped to a family: the handbook and standard forms are the same
-- for every enrolled family, same as photo albums and for the same reason.

insert into storage.buckets (id, name, public)
  values ('documents', 'documents', false)
  on conflict (id) do nothing;

create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  title         text not null,
  category      text,
  storage_path  text not null unique,
  file_name     text not null,  -- original filename, for display/download
  file_size     bigint,
  mime_type     text,
  published     boolean not null default true
);

alter table public.documents enable row level security;

create policy "Admins manage documents"
  on public.documents for all to authenticated
  using (is_admin()) with check (is_admin());

create policy "Authenticated users read published documents"
  on public.documents for select to authenticated
  using (published = true);

grant select, insert, update, delete on public.documents to authenticated;
grant all on public.documents to service_role;

-- Storage access mirrors the documents table: admins get full access to
-- the bucket; any authenticated user (any portal guardian) can read the
-- underlying file ONLY for a row that's published -- enforced by joining
-- back to public.documents rather than trusting the bucket alone.
create policy "Admins manage document files"
  on storage.objects for all to authenticated
  using (bucket_id = 'documents' and is_admin())
  with check (bucket_id = 'documents' and is_admin());

create policy "Authenticated users read published document files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.documents d
      where d.storage_path = storage.objects.name and d.published = true
    )
  );
