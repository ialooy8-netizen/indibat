
-- =========================================================
-- ROLES & PROFILES
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('master', 'principal', 'teacher', 'print_manager');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Profile + first-user-becomes-master trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'master');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Profiles RLS
CREATE POLICY "profiles: signed-in users can view all profiles"
ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles: users update own profile"
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles: master can update any profile"
ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'master'));

-- User roles RLS
CREATE POLICY "user_roles: users view own roles"
ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_roles: master views all"
ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'master'));
CREATE POLICY "user_roles: master inserts"
ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'master'));
CREATE POLICY "user_roles: master updates"
ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'master'));
CREATE POLICY "user_roles: master deletes"
ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'master'));

-- =========================================================
-- CORE DOMAIN
-- =========================================================
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  grade TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_classes_updated_at BEFORE UPDATE ON public.classes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "classes: staff read" ON public.classes FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "classes: master writes" ON public.classes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'master'));
CREATE POLICY "classes: master updates" ON public.classes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'master'));
CREATE POLICY "classes: master deletes" ON public.classes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'master'));

CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  national_id TEXT,
  parent_phone TEXT,
  parent_name TEXT,
  gender TEXT,
  behavior_points INT NOT NULL DEFAULT 100,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_students_updated_at BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_students_class ON public.students(class_id);

CREATE POLICY "students: staff read" ON public.students FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "students: master+principal insert" ON public.students FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'principal'));
CREATE POLICY "students: master+principal update" ON public.students FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'principal'));
CREATE POLICY "students: master delete" ON public.students FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'master'));

-- =========================================================
-- ATTENDANCE
-- =========================================================
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  period INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('present','absent','late','excused')),
  recorded_by UUID REFERENCES auth.users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, date, period)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_attendance_updated_at BEFORE UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_attendance_student_date ON public.attendance(student_id, date);

CREATE POLICY "attendance: staff read" ON public.attendance FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "attendance: staff insert" ON public.attendance FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "attendance: own or admin update" ON public.attendance FOR UPDATE TO authenticated
USING (recorded_by = auth.uid() OR public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'principal'));
CREATE POLICY "attendance: admin delete" ON public.attendance FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'principal'));

-- =========================================================
-- BEHAVIOR INCIDENTS (with auto point sync)
-- =========================================================
CREATE TABLE public.behavior_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('reward','infraction')),
  points INT NOT NULL,
  severity TEXT CHECK (severity IN ('mild','moderate','serious')),
  note TEXT,
  teacher_id UUID REFERENCES auth.users(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.behavior_incidents TO authenticated;
GRANT ALL ON public.behavior_incidents TO service_role;
ALTER TABLE public.behavior_incidents ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_behavior_student_date ON public.behavior_incidents(student_id, date);

CREATE OR REPLACE FUNCTION public.apply_behavior_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE delta INT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    delta := CASE WHEN NEW.type='reward' THEN NEW.points ELSE -NEW.points END;
    UPDATE public.students SET behavior_points = behavior_points + delta WHERE id = NEW.student_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    delta := CASE WHEN OLD.type='reward' THEN OLD.points ELSE -OLD.points END;
    UPDATE public.students SET behavior_points = behavior_points - delta WHERE id = OLD.student_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_behavior_points_ai AFTER INSERT ON public.behavior_incidents
FOR EACH ROW EXECUTE FUNCTION public.apply_behavior_points();
CREATE TRIGGER trg_behavior_points_ad AFTER DELETE ON public.behavior_incidents
FOR EACH ROW EXECUTE FUNCTION public.apply_behavior_points();

CREATE POLICY "behavior: staff read" ON public.behavior_incidents FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "behavior: staff insert" ON public.behavior_incidents FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "behavior: own or admin delete" ON public.behavior_incidents FOR DELETE TO authenticated
USING (teacher_id = auth.uid() OR public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'principal'));

-- =========================================================
-- PARENT COMMS LOG
-- =========================================================
CREATE TABLE public.parent_comms_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT,
  sender_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.parent_comms_log TO authenticated;
GRANT ALL ON public.parent_comms_log TO service_role;
ALTER TABLE public.parent_comms_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comms: staff read" ON public.parent_comms_log FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "comms: staff insert" ON public.parent_comms_log FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- =========================================================
-- RESOURCE BOOKINGS
-- =========================================================
CREATE TABLE public.resource_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource TEXT NOT NULL,
  booking_date DATE NOT NULL,
  day_label TEXT,
  period TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  unseen_admin BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_bookings TO authenticated;
GRANT ALL ON public.resource_bookings TO service_role;
ALTER TABLE public.resource_bookings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON public.resource_bookings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "bookings: staff read" ON public.resource_bookings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "bookings: staff insert own" ON public.resource_bookings FOR INSERT TO authenticated WITH CHECK (employee_id = auth.uid() AND public.is_staff(auth.uid()));
CREATE POLICY "bookings: admin update" ON public.resource_bookings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'principal'));
CREATE POLICY "bookings: own delete" ON public.resource_bookings FOR DELETE TO authenticated
USING (employee_id = auth.uid() OR public.has_role(auth.uid(),'master'));

-- =========================================================
-- LEAVE REQUESTS
-- =========================================================
CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewer_id UUID REFERENCES auth.users(id),
  review_note TEXT,
  unseen_admin BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_leaves_updated_at BEFORE UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "leaves: own or admin read" ON public.leave_requests FOR SELECT TO authenticated
USING (employee_id = auth.uid() OR public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'principal'));
CREATE POLICY "leaves: staff insert own" ON public.leave_requests FOR INSERT TO authenticated WITH CHECK (employee_id = auth.uid() AND public.is_staff(auth.uid()));
CREATE POLICY "leaves: admin update" ON public.leave_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'principal'));

-- =========================================================
-- PRINT REQUESTS
-- =========================================================
CREATE TABLE public.print_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  copies INT NOT NULL DEFAULT 1,
  file_url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','printed','rejected')),
  unseen_admin BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_requests TO authenticated;
GRANT ALL ON public.print_requests TO service_role;
ALTER TABLE public.print_requests ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_prints_updated_at BEFORE UPDATE ON public.print_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "prints: own or admin read" ON public.print_requests FOR SELECT TO authenticated
USING (employee_id = auth.uid() OR public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'principal') OR public.has_role(auth.uid(),'print_manager'));
CREATE POLICY "prints: staff insert own" ON public.print_requests FOR INSERT TO authenticated WITH CHECK (employee_id = auth.uid() AND public.is_staff(auth.uid()));
CREATE POLICY "prints: admin update" ON public.print_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'principal') OR public.has_role(auth.uid(),'print_manager'));

-- =========================================================
-- CIRCULARS
-- =========================================================
CREATE TABLE public.circulars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  file_url TEXT,
  posted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.circulars TO authenticated;
GRANT ALL ON public.circulars TO service_role;
ALTER TABLE public.circulars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "circulars: staff read" ON public.circulars FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "circulars: admin write" ON public.circulars FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'principal'));
CREATE POLICY "circulars: admin update" ON public.circulars FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'principal'));
CREATE POLICY "circulars: admin delete" ON public.circulars FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'principal'));

-- =========================================================
-- TIMETABLES
-- =========================================================
CREATE TABLE public.timetables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('class','teacher','school')),
  ref_id UUID,
  title TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timetables TO authenticated;
GRANT ALL ON public.timetables TO service_role;
ALTER TABLE public.timetables ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_timetables_updated_at BEFORE UPDATE ON public.timetables
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "timetables: staff read" ON public.timetables FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "timetables: admin write" ON public.timetables FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'principal'))
WITH CHECK (public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'principal'));

-- =========================================================
-- FACILITY CONFIG (single row, master-editable)
-- =========================================================
CREATE TABLE public.facility_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  periods_per_day INT NOT NULL DEFAULT 7,
  working_days TEXT[] NOT NULL DEFAULT ARRAY['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس'],
  resources TEXT[] NOT NULL DEFAULT ARRAY['مختبر العلوم','قاعة المسرح','المكتبة'],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.facility_config TO authenticated;
GRANT ALL ON public.facility_config TO service_role;
ALTER TABLE public.facility_config ENABLE ROW LEVEL SECURITY;
INSERT INTO public.facility_config (id) VALUES (1);
CREATE POLICY "config: staff read" ON public.facility_config FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "config: master update" ON public.facility_config FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'master'));
