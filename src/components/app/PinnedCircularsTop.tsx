import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, Pin, Clock } from "lucide-react";

type Circular = {
  id: string;
  title: string;
  body: string | null;
  pinned: boolean;
  expires_at: string | null;
  created_at: string;
};

export function PinnedCircularsTop() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["circulars-top"],
    refetchInterval: 60000,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("circulars")
        .select("id, title, body, pinned, expires_at, created_at")
        .or(`pinned.eq.true,expires_at.gt.${nowIso}`)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as Circular[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("circulars-top-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "circulars" }, () => {
        qc.invalidateQueries({ queryKey: ["circulars-top"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  if (!list.data?.length) return null;

  return (
    <div className="mb-4 space-y-2">
      {list.data.map((c) => (
        <Link key={c.id} to="/circulars"
          className={`block glass rounded-xl px-4 py-3 border-r-4 hover:bg-white/5 transition ${
            c.pinned ? "border-accent" : "border-primary/60"
          }`}>
          <div className="flex items-start gap-3">
            {c.pinned
              ? <Pin className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              : <Megaphone className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate">{c.title}</div>
              {c.body && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 whitespace-pre-wrap">{c.body}</p>}
              <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                <span>{new Date(c.created_at).toLocaleDateString("ar-BH")}</span>
                {c.pinned && <span className="inline-flex items-center gap-1 text-accent"><Pin className="h-3 w-3" /> مثبّت</span>}
                {!c.pinned && c.expires_at && (
                  <span className="inline-flex items-center gap-1 text-warning">
                    <Clock className="h-3 w-3" /> ينتهي {new Date(c.expires_at).toLocaleTimeString("ar-BH", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
