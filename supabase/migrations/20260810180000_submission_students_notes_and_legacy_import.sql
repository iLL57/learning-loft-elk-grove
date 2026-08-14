-- Preserve original free-text context (e.g. imported ages) per child on
-- an application, since grade_level alone can lose nuance like
-- "3 (turns 4 in Oct)" that matters when an admin later confirms the
-- real grade at enrollment package time.

alter table public.submission_students
  add column notes text;
