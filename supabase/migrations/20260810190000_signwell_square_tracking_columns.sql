-- Track the SignWell document and Square payment link created for each
-- enrolled student, so incoming webhooks can look up the right row and
-- flip documents_signed / initial_payment_received automatically.

alter table public.enrolled_students
  add column signwell_document_id text,
  add column signwell_signing_url text,
  add column square_payment_link_id text,
  add column square_order_id text,
  add column square_payment_link_url text;

create index if not exists enrolled_students_signwell_document_id_idx
  on public.enrolled_students (signwell_document_id);

create index if not exists enrolled_students_square_order_id_idx
  on public.enrolled_students (square_order_id);
