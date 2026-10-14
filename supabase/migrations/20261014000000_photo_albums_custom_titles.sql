-- Photo Albums used to be exclusively one-per-month (e.g. "October 2026").
-- The owner also wants a standing, non-monthly link (e.g. a general
-- "Student Photos" Google album) alongside the monthly ones.
--
-- `month` becomes optional; a new `title` column is the display label for
-- a non-monthly album. Exactly one of the two must be set per row. NULL is
-- distinct from other NULLs in a unique index, so multiple custom (no
-- month) albums can coexist without conflicting with the existing
-- one-per-month uniqueness.

alter table public.photo_albums
  alter column month drop not null,
  add column title text;

alter table public.photo_albums
  add constraint photo_albums_month_or_title_check
  check (month is not null or title is not null);
