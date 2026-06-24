
-- Remove auto-master behavior from handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  RETURN NEW;
END $function$;

-- App settings: singleton row keyed by 'main' for branding (logos)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads app_settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "master writes app_settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master')) WITH CHECK (public.has_role(auth.uid(), 'master'));

INSERT INTO public.app_settings (key, value) VALUES ('branding', '{"logoUrl":null,"homeLogoUrl":null}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Staff notices (broadcast banners) — used by printer to announce delays
CREATE TABLE IF NOT EXISTS public.staff_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  body TEXT,
  severity TEXT NOT NULL DEFAULT 'info', -- info | warning | critical
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.staff_notices TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.staff_notices TO authenticated;
GRANT ALL ON public.staff_notices TO service_role;
ALTER TABLE public.staff_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read notices" ON public.staff_notices FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "printer or admin insert notices" ON public.staff_notices FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'print_manager'));
CREATE POLICY "owner or admin update notices" ON public.staff_notices FOR UPDATE TO authenticated
  USING (posted_by = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "owner or admin delete notices" ON public.staff_notices FOR DELETE TO authenticated
  USING (posted_by = auth.uid() OR public.is_admin(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_notices;
