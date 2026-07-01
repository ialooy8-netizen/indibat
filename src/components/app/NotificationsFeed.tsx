import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Bell, Check, CheckCircle2, XCircle, Printer, FileText, Info } from "lucide-react";

type Notif = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

function iconFor(kind: string) {
  if (kind.startsWith("leave_approved")) return CheckCircle2;
  if (kind.startsWith("leave_rejected")) return XCircle;
  if (kind.startsWith("print_")) return Printer;
  if (kind.startsWith("event_")) return FileText;
  return Info;
}

export function NotificationsFeed() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["notifs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, kind, title, body, link, read_at, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return (data ?? []) as Notif[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notifs-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["notifs", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const markAll = useMutation({
    mutationFn: async () => {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() })
        .eq("user_id", user!.id).is("read_at", null);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifs", user?.id] }),
  });

  const unread = (list.data ?? []).filter((n) => !n.read_at).length;

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" /> إشعاراتي
          {unread > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground animate-pulse">{unread}</span>}
        </h3>
        {unread > 0 && (
          <button onClick={() => markAll.mutate()} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
            <Check className="h-3 w-3" /> تعليم الكل كمقروء
          </button>
        )}
      </div>
      {(!list.data || list.data.length === 0) && (
        <p className="text-sm text-muted-foreground text-center py-4">لا توجد إشعارات.</p>
      )}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {list.data?.map((n) => {
          const Icon = iconFor(n.kind);
          return (
            <div key={n.id} className={`flex items-start gap-2 rounded-xl px-3 py-2 border ${n.read_at ? "border-border/30 opacity-70" : "border-primary/40 bg-primary/5"}`}>
              <Icon className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{n.title}</div>
                {n.body && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{n.body}</p>}
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(n.created_at).toLocaleString("ar-BH", { dateStyle: "short", timeStyle: "short" })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
