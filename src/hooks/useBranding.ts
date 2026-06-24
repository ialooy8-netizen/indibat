import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import defaultLogo from "@/assets/edupulse-logo.png.asset.json";

export type Branding = { logoUrl: string | null; homeLogoUrl: string | null };

export function useBranding() {
  const q = useQuery({
    queryKey: ["branding"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "branding").maybeSingle();
      return (data?.value as Branding) ?? { logoUrl: null, homeLogoUrl: null };
    },
  });
  const b = q.data ?? { logoUrl: null, homeLogoUrl: null };
  return {
    logoUrl: b.logoUrl || defaultLogo.url,
    homeLogoUrl: b.homeLogoUrl || b.logoUrl || defaultLogo.url,
    loading: q.isPending,
  };
}
