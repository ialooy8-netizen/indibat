
-- event_submissions
CREATE TABLE public.event_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','needs_edits')),
  reviewer_id UUID REFERENCES auth.users(id),
  reviewer_note TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  approved_pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_submissions TO authenticated;
GRANT ALL ON public.event_submissions TO service_role;
ALTER TABLE public.event_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events: own or admin read" ON public.event_submissions FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "events: teacher insert" ON public.event_submissions FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "events: teacher edit own pending" ON public.event_submissions FOR UPDATE TO authenticated
  USING ((teacher_id = auth.uid() AND status IN ('pending','needs_edits')) OR public.is_admin(auth.uid()));
CREATE POLICY "events: master delete" ON public.event_submissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'master') OR teacher_id = auth.uid());
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON public.event_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_submissions;

-- chat_settings (single row keyed by id=1)
CREATE TABLE public.chat_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  retention_mode TEXT NOT NULL DEFAULT 'manual' CHECK (retention_mode IN ('manual','daily','custom')),
  retention_days INT NOT NULL DEFAULT 7,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.chat_settings TO authenticated;
GRANT ALL ON public.chat_settings TO service_role;
ALTER TABLE public.chat_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_settings: read" ON public.chat_settings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "chat_settings: master write" ON public.chat_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'master')) WITH CHECK (public.has_role(auth.uid(),'master'));
INSERT INTO public.chat_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Seed default app_settings
INSERT INTO public.app_settings (key, value) VALUES
  ('app_name', '{"name":"EduPulse | نبض","tagline":"الذكاء الذي يرصد نبض المدرسة"}'::jsonb),
  ('about', '{"body":"يُعد EduPulse | نبض منصة رقمية تعليمية متكاملة صُممت لدعم التحول الرقمي وإدارة العمليات المدرسية بكفاءة.","email":"ali.y.hassan@moe.bh","phone":""}'::jsonb),
  ('school_header', '{"headerUrl":null,"schoolName":"","footerNote":""}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Seed feature flags for main features
INSERT INTO public.feature_flags (key, enabled) VALUES
  ('attendance', true), ('students', true), ('timetables', true), ('facilities', true),
  ('leaves', true), ('print', true), ('predictor', true), ('circulars', true),
  ('chat', true), ('lesson-planner', true), ('reports', true), ('events', true)
ON CONFLICT (key) DO NOTHING;

-- Seed feature help
INSERT INTO public.feature_help (key, title, content) VALUES
  ('attendance', 'الحضور والتقييم', 'اختر الصف، وسيتم افتراض حضور الجميع. علّم فقط الغائبين والمتأخرين لتوفير الوقت. يمكنك إرسال إشعار واتساب لأولياء أمور الغائبين بضغطة واحدة.'),
  ('students', 'الطلاب والصفوف', 'أضف صف جديد، ثم استعمل «لصق قائمة» لإضافة عشرات الطلاب دفعة واحدة (اسم في كل سطر + عمود جوال). اضغط اسم الطالب لعرض ملفه الكامل.'),
  ('timetables', 'الجداول الدراسية', 'الإداري يبني الجدول الأسبوعي لكل صف. المعلمون يرون جدولهم اليومي على الصفحة الرئيسية مع مؤقت لموعد الحصة القادمة.'),
  ('facilities', 'حجز المرافق', 'حجز فوري بلا اعتماد. يعرض جدول يومي بالخانات الشاغرة والمحجوزة مع اسم الحاجز.'),
  ('leaves', 'الإجازات', 'ثلاثة أنواع: إجازة كاملة، استئذان جزئي مع وقت العودة، إشعار غياب معلم (يدعم رفع الإجازة المرضية).'),
  ('print', 'المطبوعات', 'طلب طباعة عادي مباشر لمسؤول الطباعة، أو طلب سري يمر عبر اعتماد المدير أولاً. عند الجاهزية يصلك إشعار للاستلام.'),
  ('predictor', 'المتنبئ السلوكي', 'يحسب نتيجة خطر مركّبة من: نقاط السلوك (60%) + نسبة الحضور (40%). كلما ارتفعت النتيجة زاد الخطر. يقترح رسائل ذكية لولي الأمر.'),
  ('circulars', 'التعاميم', 'مثبّت = يبقى للأبد حتى الحذف اليدوي. عام = يُحذف تلقائياً بعد 24 ساعة. تظهر في أعلى كل صفحة.'),
  ('chat', 'غرفة الموظفين', 'محادثة جماعية لكل الموظفين. اختر «سؤال» ليظهر بلون مميّز. الماستر يتحكم في مدة الحفظ.'),
  ('lesson-planner', 'مخطط الدروس AI', 'يولّد خطط دروس متوافقة مع منهج وزارة التربية البحرينية. زر الطباعة يفتح نسخة نظيفة بهوامش A4.'),
  ('reports', 'التقارير', 'مرشّح ذكي: طالب، صف، معلم، يومي، أسبوعي، مدى تاريخي. تصدير CSV أو طباعة.'),
  ('events', 'توثيق الفعاليات', 'المعلم يقدم اسم الفعالية ووصفها والأهداف؛ المدير/المساعد يوافق أو يطلب تعديلات. الموافق يُوقّع رقمياً وتُحفظ كوثيقة رسمية.')
ON CONFLICT (key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, updated_at=now();

-- Chat retention purge function
CREATE OR REPLACE FUNCTION public.purge_chat_messages()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cs RECORD;
BEGIN
  SELECT retention_mode, retention_days INTO cs FROM public.chat_settings WHERE id = 1;
  IF cs.retention_mode = 'daily' THEN
    DELETE FROM public.chat_messages WHERE created_at < now() - INTERVAL '24 hours';
  ELSIF cs.retention_mode = 'custom' AND cs.retention_days > 0 THEN
    DELETE FROM public.chat_messages WHERE created_at < now() - (cs.retention_days || ' days')::INTERVAL;
  END IF;
END $$;

-- Schedule hourly purge if not scheduled
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-chat') THEN
    PERFORM cron.schedule('purge-chat', '17 * * * *', $j$SELECT public.purge_chat_messages();$j$);
  END IF;
END $$;

-- Additional indexes
CREATE INDEX IF NOT EXISTS idx_events_teacher ON public.event_submissions(teacher_id, status);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.event_submissions(status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON public.resource_bookings(booking_date, period);
