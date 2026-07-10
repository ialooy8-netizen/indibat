
ALTER TABLE public.event_submissions
  ADD COLUMN IF NOT EXISTS event_date DATE,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS target_audience TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS onedrive_url TEXT;

-- Notify all admins when a new event is submitted (or resubmitted)
CREATE OR REPLACE FUNCTION public.notify_admins_new_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r RECORD;
BEGIN
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND NEW.status = 'pending' AND OLD.status <> 'pending') THEN
    FOR r IN
      SELECT user_id FROM public.user_roles
      WHERE role::text IN ('master','principal','vice_principal')
    LOOP
      INSERT INTO public.notifications (user_id, title, body, link_to, kind)
      VALUES (r.user_id, 'فعالية جديدة بانتظار الاعتماد: ' || NEW.event_name, NULL, '/events', 'event');
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_admins_new_event ON public.event_submissions;
CREATE TRIGGER trg_notify_admins_new_event
AFTER INSERT OR UPDATE ON public.event_submissions
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_event();
