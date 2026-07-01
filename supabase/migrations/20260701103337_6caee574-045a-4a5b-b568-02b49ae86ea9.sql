
-- === Extensions ===
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- === chat_messages ===
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'message' CHECK (kind IN ('message','question')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_created_idx ON public.chat_messages (created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat: staff read" ON public.chat_messages FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "chat: author insert" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid() AND public.is_staff(auth.uid()));
CREATE POLICY "chat: author or admin delete" ON public.chat_messages FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.is_admin(auth.uid()));
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- === notifications ===
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif: own read" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif: staff insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "notif: own update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif: admin delete" ON public.notifications FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- === feature_flags ===
CREATE TABLE public.feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  message TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flags: staff read" ON public.feature_flags FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "flags: master write" ON public.feature_flags FOR ALL TO authenticated USING (public.has_role(auth.uid(),'master'::app_role)) WITH CHECK (public.has_role(auth.uid(),'master'::app_role));

-- === feature_help ===
CREATE TABLE public.feature_help (
  key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feature_help TO authenticated;
GRANT ALL ON public.feature_help TO service_role;
ALTER TABLE public.feature_help ENABLE ROW LEVEL SECURITY;
CREATE POLICY "help: staff read" ON public.feature_help FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "help: master write" ON public.feature_help FOR ALL TO authenticated USING (public.has_role(auth.uid(),'master'::app_role)) WITH CHECK (public.has_role(auth.uid(),'master'::app_role));

-- === circulars extensions ===
ALTER TABLE public.circulars
  ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS circulars_active_idx ON public.circulars (pinned DESC, created_at DESC);

-- === profiles extension ===
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signature_url TEXT;

-- === students extension ===
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS medical_conditions TEXT,
  ADD COLUMN IF NOT EXISTS medical_steps TEXT;

-- === cron: purge expired non-pinned circulars every 10 min ===
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge_expired_circulars') THEN
    PERFORM cron.unschedule('purge_expired_circulars');
  END IF;
END $$;
SELECT cron.schedule(
  'purge_expired_circulars',
  '*/10 * * * *',
  $$ DELETE FROM public.circulars WHERE pinned = false AND expires_at IS NOT NULL AND expires_at < now(); $$
);
