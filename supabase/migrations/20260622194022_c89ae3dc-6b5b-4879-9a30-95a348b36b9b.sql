
-- 1. class_teachers mapping
CREATE TABLE public.class_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, teacher_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_teachers TO authenticated;
GRANT ALL ON public.class_teachers TO service_role;

ALTER TABLE public.class_teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage class_teachers"
  ON public.class_teachers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'principal'))
  WITH CHECK (public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'principal'));

CREATE POLICY "Teachers read own class_teachers"
  ON public.class_teachers FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'principal'));

CREATE INDEX class_teachers_teacher_idx ON public.class_teachers(teacher_id);
CREATE INDEX class_teachers_class_idx ON public.class_teachers(class_id);

-- 2. attachments
ALTER TABLE public.print_requests ADD COLUMN IF NOT EXISTS attachment_path TEXT;
ALTER TABLE public.circulars ADD COLUMN IF NOT EXISTS attachment_path TEXT;

-- 3. AI draft on incidents
ALTER TABLE public.behavior_incidents ADD COLUMN IF NOT EXISTS ai_draft TEXT;

-- 4. realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.print_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.resource_bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.behavior_incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.circulars;

ALTER TABLE public.leave_requests REPLICA IDENTITY FULL;
ALTER TABLE public.print_requests REPLICA IDENTITY FULL;
ALTER TABLE public.resource_bookings REPLICA IDENTITY FULL;
ALTER TABLE public.behavior_incidents REPLICA IDENTITY FULL;
ALTER TABLE public.circulars REPLICA IDENTITY FULL;
