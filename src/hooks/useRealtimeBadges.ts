import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Subscribes to leave/print/booking changes and refreshes badge counts + lists. */
export function useRealtimeBadges(enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel("admin-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, () => {
        qc.invalidateQueries({ queryKey: ["badge-counts"] });
        qc.invalidateQueries({ queryKey: ["leaves"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "print_requests" }, () => {
        qc.invalidateQueries({ queryKey: ["badge-counts"] });
        qc.invalidateQueries({ queryKey: ["prints"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "resource_bookings" }, () => {
        qc.invalidateQueries({ queryKey: ["badge-counts"] });
        qc.invalidateQueries({ queryKey: ["bookings"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "circulars" }, () => {
        qc.invalidateQueries({ queryKey: ["circulars"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, qc]);
}
