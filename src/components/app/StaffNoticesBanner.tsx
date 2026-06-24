import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/useRoles";
import { useAuth } from "@/hooks/useAuth";
import { AlertTriangle, Info, X, Megaphone } from "lucide-react";

type Notice = {
  id: string;
  posted_by: string | null;
  category: string;
  title: string;
  body: string | null;
  severity: "info" | "warning" | "critical";
  active: boolean;
  created_at: string;
};

export function StaffNoticesBanner() {
  const { user } = useAuth();
  const { isAdmin, isPrintManager } = useRoles();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["staff-notices-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_notices")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Notice[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("staff-notices-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_notices" }, () => {
        qc.invalidateQueries({ queryKey: ["staff-notices-active"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staff_notices").update({ active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff-notices-active"] }),
  });

  if (!list.data?.length) return null;

  return (
    <div className="space-y-2 mb-4">
      {list.data.map((n) => {
        const tone =
          n.severity === "critical" ? "bg-destructive/15 border-destructive/40 text-destructive"
          : n.severity === "warning" ? "bg-warning/15 border-warning/40 text-warning"
          : "bg-primary/15 border-primary/40 text-primary";
        const Icon = n.severity === "critical" ? AlertTriangle : n.severity === "warning" ? Megaphone : Info;
        const canDismiss = isAdmin || n.posted_by === user?.id || isPrintManager;
        return (
          <div key={n.id} className={`glass border rounded-xl px-4 py-3 flex items-start gap-3 ${tone}`}>
            <Icon className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-foreground">{n.title}</div>
              {n.body && <div className="text-xs mt-0.5 text-foreground/80 whitespace-pre-wrap">{n.body}</div>}
              <div className="text-[10px] text-muted-foreground mt-1">
                {new Date(n.created_at).toLocaleString("ar-BH", { dateStyle: "short", timeStyle: "short" })}
              </div>
            </div>
            {canDismiss && (
              <button onClick={() => dismiss.mutate(n.id)} title="إخفاء" className="text-muted-foreground hover:text-foreground p-1">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
