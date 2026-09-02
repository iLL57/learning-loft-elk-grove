-- Parent Portal foundation, part 3 of 3: import the launch roster.
--
-- The 2026-2027 launch cohort (10 families, 14 students) was enrolled
-- through an offline process before the site's application -> review ->
-- package flow existed. This seeds them into families + enrolled_students
-- so those parents can be invited to the portal.
--
-- Source of truth:
--   * family membership, student names, GRADE, and program day -> the
--     owner's handwritten enrollment sheet (IMG_7892)
--   * contact info (guardian name, email, phone) -> each family's
--     matching enrollment_submissions row, where one exists
--
-- Per the owner: every family has paid the enrollment fee and signed
-- documents EXCEPT the Steele family (fee unpaid; only Olivia's documents
-- are out for signature, none signed yet).
--
-- Two families' application was filed under a different name than the
-- sheet's family name (confirmed correct by the owner):
--   Lopez  -> Blanca Flores (bflores_05@yahoo.com)
--   Nguyen -> Han Ngo       (hanngo110789@gmail.com)
-- The Arechiga family has no application on file; seeded with no contact
-- info for the owner to fill in before inviting them.

-- enrolled_students.parent_name was required back when a student row was
-- the contact record. The family now owns the contact info, and a launch
-- family may have none on file yet (Arechiga), so loosen it here. Send
-- Package always supplies it, so nothing else regresses.
alter table public.enrolled_students
  alter column parent_name drop not null;

-- ── Families ──
insert into public.families (family_name, primary_guardian_name, primary_email, primary_phone, source_submission_id)
values
  ('Burton',   'Nichol Burton',  'nicholburton@gmail.com',        '19162847929',
     (select id from public.enrollment_submissions where email = 'nicholburton@gmail.com'        order by created_at desc limit 1)),
  ('Lopez',    'Blanca Flores',  'bflores_05@yahoo.com',          '9162729980',
     (select id from public.enrollment_submissions where email = 'bflores_05@yahoo.com'          order by created_at desc limit 1)),
  ('Arechiga', null,             null,                            null,             null),
  ('Nguyen',   'Han Ngo',        'hanngo110789@gmail.com',        '(916) 346-8825',
     (select id from public.enrollment_submissions where email = 'hanngo110789@gmail.com'        order by created_at desc limit 1)),
  ('Bennett',  'Heather Bennett','heatherbennett31@yahoo.com',    '9167565851',
     (select id from public.enrollment_submissions where email = 'heatherbennett31@yahoo.com'    order by created_at desc limit 1)),
  ('Cardenas', 'Jordan Cardenas','englandjordan89@gmail.com',     '9162050574',
     (select id from public.enrollment_submissions where email = 'englandjordan89@gmail.com'     order by created_at desc limit 1)),
  ('Jones',    'Claudia Jones',  'claudiajones.ca@gmail.com',     '19169692139',
     (select id from public.enrollment_submissions where email = 'claudiajones.ca@gmail.com'     order by created_at desc limit 1)),
  ('Madrigal', 'Ashley Madrigal','ashley.madrigal1991@gmail.com', '9166287422',
     (select id from public.enrollment_submissions where email = 'ashley.madrigal1991@gmail.com' order by created_at desc limit 1)),
  ('Steele',   'Alyssa Steele',  'alymariesteele@gmail.com',      '9162031794',
     (select id from public.enrollment_submissions where email = 'alymariesteele@gmail.com'      order by created_at desc limit 1));

-- ── Students ──
-- parent_name / email / phone are copied from the family so existing
-- admin views (which still read those columns) render correctly; the
-- family record is the canonical contact going forward.
insert into public.enrolled_students
  (family_id, parent_name, email, phone, student_name, grade_level, program_day,
   payment_status, documents_signed, initial_payment_received, submission_id)
select
  f.id, f.primary_guardian_name, f.primary_email, f.primary_phone,
  s.student_name, s.grade_level, s.program_day,
  s.payment_status, s.documents_signed, s.initial_payment_received,
  f.source_submission_id
from public.families f
join (
  values
    ('Burton',   'Hunter',            '2', 'Tue',        'current', true,  true ),
    ('Burton',   'Preslie',           'K', 'Tue',        'current', true,  true ),
    ('Lopez',    'Xzavien',           '3', 'Thu',        'current', true,  true ),
    ('Arechiga', 'Luna',              '3', 'Thu',        'current', true,  true ),
    ('Arechiga', 'Maia',              'K', 'Thu',        'current', true,  true ),
    ('Nguyen',   'Mia',               'K', 'Tue & Thu',  'current', true,  true ),
    ('Bennett',  'Vincent Bennett',   '4', 'Thu',        'current', true,  true ),
    ('Bennett',  'Scarlett Bennett',  '1', 'Thu',        'current', true,  true ),
    ('Cardenas', 'Hunter Cardenas',   '1', 'Tue & Thu',  'current', true,  true ),
    ('Jones',    'Nello',             '3', 'Thu',        'current', true,  true ),
    ('Madrigal', 'Zander Madrigal',   '1', 'Thu',        'current', true,  true ),
    ('Madrigal', 'Savannah Madrigal', '2', 'Thu',        'current', true,  true ),
    ('Steele',   'Olivia Steele',     '1', 'Thu',        'pending', false, false),
    ('Steele',   'Memphis Steele',    'K', 'Thu',        'pending', false, false)
) as s(family_name, student_name, grade_level, program_day, payment_status, documents_signed, initial_payment_received)
  on s.family_name = f.family_name;

-- ── Mark the matched applications as handled ──
-- so they stop showing as "new" / actionable in the admin Submissions tab
-- and can't be accidentally run through Send Package a second time.
update public.enrollment_submissions
  set status = 'package_sent'
  where email in (
    'nicholburton@gmail.com', 'bflores_05@yahoo.com', 'hanngo110789@gmail.com',
    'heatherbennett31@yahoo.com', 'englandjordan89@gmail.com', 'claudiajones.ca@gmail.com',
    'ashley.madrigal1991@gmail.com', 'alymariesteele@gmail.com'
  )
  and status = 'new';
