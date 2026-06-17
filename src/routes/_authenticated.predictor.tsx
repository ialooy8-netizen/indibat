import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Brain, MessageSquare, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/predictor")({
  component: PredictorPage,
});

function PredictorPage() {
  const atRisk = useQuery({
    queryKey: ["at-risk"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*, classes(name)")
        .lt("behavior_points", 70)
        .order("behavior_points", { ascending: true })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold flex items-center gap-2"><Brain className="h-7 w-7 text-accent" /> المتنبئ السلوكي</h2>
        <p className="text-muted-foreground text-sm mt-1">طلاب تحت خط الإنذار (نقاط السلوك أقل من 70)</p>
      </div>

      {atRisk.data?.length === 0 && (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
          🎉 لا يوجد طلاب في منطقة الخطر حالياً.
        </div>
      )}

      <div className="space-y-3">
        {atRisk.data?.map((s) => {
          const sev = s.behavior_points < 40 ? "حرج" : s.behavior_points < 60 ? "عالي" : "متوسط";
          const sevColor = s.behavior_points < 40 ? "destructive" : s.behavior_points < 60 ? "warning" : "warning";
          const msg = `السلام عليكم، نود إعلامكم بأن مستوى السلوك لدى الطالب ${s.name} يستدعي الاهتمام. نرجو التواصل مع إدارة المدرسة.`;
          const wa = s.parent_phone ? `https://wa.me/${s.parent_phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}` : null;
          return (
            <div key={s.id} className="glass rounded-xl p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <Link to="/students/$id" params={{ id: s.id }} className="font-semibold hover:text-primary">{s.name}</Link>
                <p className="text-xs text-muted-foreground">{(s.classes as { name: string } | null)?.name ?? ""}</p>
              </div>
              <div className={`text-xs font-bold px-3 py-1 rounded-full bg-${sevColor}/20 text-${sevColor}`}>{sev}</div>
              <div className="text-2xl font-bold tabular-nums">{s.behavior_points}</div>
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline" className="gap-2"><MessageSquare className="h-4 w-4" /> إشعار</Button>
                </a>
              )}
              <Link to="/students/$id" params={{ id: s.id }}>
                <Button size="sm" variant="ghost" className="gap-1">التفاصيل <ArrowLeft className="h-4 w-4" /></Button>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
