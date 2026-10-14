-- Monthly photo albums for the parent portal. Photos themselves live in a
-- Google Drive folder per month (owner's existing workflow) — this table
-- just holds the list of months and their Drive links, managed from the
-- admin dashboard.
--
-- Unlike families/students/etc., albums are NOT scoped to a family: every
-- enrolled guardian should see every month's album (group/classroom
-- photos), same as a school photo board. `published` lets an admin stage
-- next month's link before parents see it.

create table public.photo_albums (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  month       date not null unique,  -- first-of-month, e.g. 2026-10-01; display label derived from it
  drive_url   text not null,
  published   boolean not null default true
);

alter table public.photo_albums enable row level security;

create policy "Admins manage photo albums"
  on public.photo_albums for all to authenticated
  using (is_admin()) with check (is_admin());

-- Any authenticated portal user (guardian or admin) can read published
-- albums — not scoped by family, since these are program-wide photos.
create policy "Authenticated users read published albums"
  on public.photo_albums for select to authenticated
  using (published = true);

grant select, insert, update, delete on public.photo_albums to authenticated;
grant all on public.photo_albums to service_role;
