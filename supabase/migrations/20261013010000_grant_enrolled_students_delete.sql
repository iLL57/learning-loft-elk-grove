-- Admin needed a way to remove a student from Enrolled Students (previously
-- only Edit/Save existed, no delete). RLS already allows this for admins
-- via the existing "Admins can manage enrolled students" (for all) policy
-- from the role-gate migration — this just adds the missing table grant.

grant delete on public.enrolled_students to authenticated;
