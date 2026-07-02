import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type AppNameSetting = { name: string; tagline: string };

export function useAppName() {
  const q = useQuery({
    queryKey: ["app-name"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "app_name").maybeSingle();
      return (data?.value as AppNameSetting) ?? { name: "EduPulse | نبض", tagline: "الذكاء الذي يرصد نبض المدرسة" };
    },
  });
  return q.data ?? { name: "EduPulse | نبض", tagline: "الذكاء الذي يرصد نبض المدرسة" };
}
