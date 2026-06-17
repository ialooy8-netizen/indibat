import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Star, AlertTriangle, TrendingUp, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/students/$id")({
  component: StudentProfile,
});

function StudentProfile() {
  const { id } = Route.useParams();

  const student = useQuery({
    queryKey: ["student", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*, classes(name)").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const incidents = useQuery({
    queryKey: ["student-incidents", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("behavior_incidents").select("*").eq("student_id", id).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });

  const attendance = useQuery({
    queryKey: ["student-attendance", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance").select("status").eq("student_id", id);
      if (error) throw error;
      return data;
    },
  });

  const total = attendance.data?.length ?? 0;
  const absent = attendance.data?.filter((a) => a.status === "absent").length ?? 0;
  const rate = total > 0 ? Math.round(((total - absent) / total) * 100) : 100;

  if (student.isLoading) return <div className="text-muted-foreground">جاري التحميل...</div>;
  if (!student.data) return <div className="text-muted-foreground">الطالب غير موجود</div>;

  const s = student.data;
  const waLink = s.parent_phone ? `https://wa.me/${s.parent_phone.replace(/\D/g, "")}?text=${encodeURIComponent(`السلام عليكم، بخصوص الطالب ${s.name}`)}` : null;

  return (
    <div className="space-y-6">
      <Link to="/students" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="h-4 w-4" /> العودة للطلاب
      </Link>

      <div className="glass-strong rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">{s.name}</h2>
            <p className="text-muted-foreground">{(s.classes as { name: string } | null)?.name ?? "بدون صف"}</p>
            {s.parent_name && <p className="text-sm text-muted-foreground mt-1">ولي الأمر: {s.parent_name}</p>}
          </div>
          {waLink && (
            <a href={waLink} target="_blank" rel="noreferrer">
              <Button variant="outline" className="gap-2"><MessageSquare className="h-4 w-4" /> واتساب ولي الأمر</Button>
            </a>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3 mt-6">
          <Stat label="نقاط السلوك" value={s.behavior_points} icon={Star} tone={s.behavior_points >= 80 ? "success" : s.behavior_points >= 60 ? "warning" : "destructive"} />
          <Stat label="نسبة الحضور" value={`${rate}%`} icon={TrendingUp} tone="primary" />
          <Stat label="مرات الغياب" value={absent} icon={AlertTriangle} tone={absent > 5 ? "destructive" : "muted"} />
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-3">السجل السلوكي</h3>
        <div className="space-y-2">
          {incidents.data?.map((i) => (
            <div key={i.id} className={`glass rounded-xl p-3 border-r-4 ${i.type === "reward" ? "border-success" : i.severity === "serious" ? "border-destructive" : i.severity === "moderate" ? "border-warning" : "border-warning/50"}`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold ${i.type === "reward" ? "text-success" : "text-destructive"}`}>
                  {i.type === "reward" ? "+" : "-"}{i.points} نقطة
                </span>
                <span className="text-xs text-muted-foreground">{new Date(i.created_at).toLocaleDateString("ar")}</span>
              </div>
              {i.note && <p className="text-sm mt-1">{i.note}</p>}
            </div>
          ))}
          {incidents.data?.length === 0 && <p className="text-muted-foreground text-sm text-center py-6">لا يوجد سجل سلوكي بعد</p>}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone }: { label: string; value: number | string; icon: React.ComponentType<{ className?: string }>; tone: "primary" | "success" | "warning" | "destructive" | "muted" }) {
  const t = { primary: "text-primary", success: "text-success", warning: "text-warning", destructive: "text-destructive", muted: "text-muted-foreground" }[tone];
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${t}`} />
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
