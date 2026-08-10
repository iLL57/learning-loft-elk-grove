-- Convert enrolled_families (one row per family) into enrolled_students
-- (one row per student), tracking each student's TK-6 grade level
-- individually and moving payment tracking to the student level.
--
-- Existing rows are known test/demo data from initial dashboard setup;
-- safe to clear rather than attempt to split multi-child rows.

delete from public.enrolled_families;

alter table public.enrolled_families rename to enrolled_students;
alter table public.enrolled_students rename column child_name to student_name;
alter table public.enrolled_students rename column child_age to student_age;

alter table public.enrolled_students
  add column grade_level text not null;

alter table public.enrolled_students
  add constraint enrolled_students_grade_level_check
  check (grade_level in ('TK','K','1','2','3','4','5','6'));
