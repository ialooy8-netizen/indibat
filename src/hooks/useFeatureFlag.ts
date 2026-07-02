import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Reads feature_flags for a given key. Returns { enabled, message, loading }. */
export function useFeatureFlag(key: string) {
  const q = useQuery({
    queryKey: ["feature-flag", key],
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase.from("feature_flags").select("enabled, message").eq("key", key).maybeSingle();
      return data ?? { enabled: true, message: null as string | null };
    },
  });
  // realtime updates
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const ch = supabase.channel(`ff-${key}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "feature_flags", filter: `key=eq.${key}` }, () => setTick((t) => t + 1))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [key]);
  useEffect(() => { q.refetch(); }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  return { enabled: q.data?.enabled ?? true, message: q.data?.message ?? null, loading: q.isPending };
}
