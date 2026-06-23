-- Admin helper (master / principal / vice_principal)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('master','principal','vice_principal')
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

-- Profiles
DROP POLICY IF EXISTS "profiles: master can update any profile" ON public.profiles;
CREATE POLICY "profiles: admin can update any profile" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- Students
DROP POLICY IF EXISTS "students: master+principal insert" ON public.students;
DROP POLICY IF EXISTS "students: master+principal update" ON public.students;
CREATE POLICY "students: admin insert" ON public.students
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "students: admin update" ON public.students
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- Leaves
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS leave_type text NOT NULL DEFAULT 'full_day',
  ADD COLUMN IF NOT EXISTS leave_from time,
  ADD COLUMN IF NOT EXISTS expected_return time,
  ADD COLUMN IF NOT EXISTS will_return boolean,
  ADD COLUMN IF NOT EXISTS attachment_path text;
ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS leave_requests_leave_type_check;
ALTER TABLE public.leave_requests
  ADD CONSTRAINT leave_requests_leave_type_check
  CHECK (leave_type IN ('full_day','partial_leave','teacher_absence_notice'));

DROP POLICY IF EXISTS "leaves: admin update" ON public.leave_requests;
DROP POLICY IF EXISTS "leaves: own or admin read" ON public.leave_requests;
CREATE POLICY "leaves: admin update" ON public.leave_requests
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "leaves: own or admin read" ON public.leave_requests
  FOR SELECT TO authenticated
  USING ((employee_id = auth.uid()) OR public.is_admin(auth.uid()));

-- Print requests
ALTER TABLE public.print_requests
  ADD COLUMN IF NOT EXISTS is_confidential boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS principal_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS principal_approved_by uuid REFERENCES auth.users(id);

ALTER TABLE public.print_requests DROP CONSTRAINT IF EXISTS print_requests_status_check;
ALTER TABLE public.print_requests
  ADD CONSTRAINT print_requests_status_check
  CHECK (status IN ('pending','pending_principal','approved','printed','rejected'));

DROP POLICY IF EXISTS "prints: admin update" ON public.print_requests;
DROP POLICY IF EXISTS "prints: own or admin read" ON public.print_requests;
CREATE POLICY "prints: admin update" ON public.print_requests
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'print_manager'));
CREATE POLICY "prints: own or admin read" ON public.print_requests
  FOR SELECT TO authenticated
  USING ((employee_id = auth.uid()) OR public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'print_manager'));

-- Resource bookings — no approval
ALTER TABLE public.resource_bookings ALTER COLUMN status SET DEFAULT 'approved';
UPDATE public.resource_bookings SET status='approved' WHERE status='pending';
DROP POLICY IF EXISTS "bookings: admin update" ON public.resource_bookings;
CREATE POLICY "bookings: admin or owner update" ON public.resource_bookings
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR employee_id = auth.uid());

-- Circulars
DROP POLICY IF EXISTS "circulars: admin write" ON public.circulars;
DROP POLICY IF EXISTS "circulars: admin update" ON public.circulars;
DROP POLICY IF EXISTS "circulars: admin delete" ON public.circulars;
CREATE POLICY "circulars: admin write" ON public.circulars
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "circulars: admin update" ON public.circulars
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "circulars: admin delete" ON public.circulars
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Class teachers
DROP POLICY IF EXISTS "Admins manage class_teachers" ON public.class_teachers;
DROP POLICY IF EXISTS "Teachers read own class_teachers" ON public.class_teachers;
CREATE POLICY "class_teachers: admin manage" ON public.class_teachers
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "class_teachers: teachers read own" ON public.class_teachers
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.is_admin(auth.uid()));

-- Timetables
DROP POLICY IF EXISTS "timetables: admin write" ON public.timetables;
CREATE POLICY "timetables: admin write" ON public.timetables
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Attendance
DROP POLICY IF EXISTS "attendance: admin delete" ON public.attendance;
DROP POLICY IF EXISTS "attendance: own or admin update" ON public.attendance;
CREATE POLICY "attendance: admin delete" ON public.attendance
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "attendance: own or admin update" ON public.attendance
  FOR UPDATE TO authenticated
  USING (recorded_by = auth.uid() OR public.is_admin(auth.uid()));

-- Behavior
DROP POLICY IF EXISTS "behavior: own or admin delete" ON public.behavior_incidents;
CREATE POLICY "behavior: own or admin delete" ON public.behavior_incidents
  FOR DELETE TO authenticated
  USING (teacher_id = auth.uid() OR public.is_admin(auth.uid()));

-- Demo flags
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.classes  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- Lesson plans
CREATE TABLE IF NOT EXISTS public.lesson_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  grade text,
  topic text NOT NULL,
  duration_minutes integer DEFAULT 45,
  objectives text,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_plans TO authenticated;
GRANT ALL ON public.lesson_plans TO service_role;
ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lesson_plans: own read" ON public.lesson_plans
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "lesson_plans: own insert" ON public.lesson_plans
  FOR INSERT TO authenticated WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "lesson_plans: own update" ON public.lesson_plans
  FOR UPDATE TO authenticated USING (teacher_id = auth.uid());
CREATE POLICY "lesson_plans: own delete" ON public.lesson_plans
  FOR DELETE TO authenticated
  USING (teacher_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE TRIGGER trg_lesson_plans_updated_at BEFORE UPDATE ON public.lesson_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();