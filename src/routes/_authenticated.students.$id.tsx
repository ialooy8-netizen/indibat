import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/useRoles";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowRight, Star, AlertTriangle, TrendingUp, MessageSquare, Trash2, CalendarDays, Phone, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { StudentQRBadge } from "@/components/app/StudentQRBadge";

export const Route = createFileRoute("/_authenticated/students/$id")({
  component: StudentProfile,
});

function StudentProfile() {
  const { id } = Route.useParams();
  const { isMaster } = useRoles();
  const navigate = useNavigate();
  const qc = useQueryClient();

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
      const { data, error } = await supabase.from("behavior_incidents").select("*").eq("student_id", id).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const attendance = useQuery({
    queryKey: ["student-attendance-full", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance").select("status, date, period").eq("student_id", id).order("date", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
  });

  const comms = useQuery({
    queryKey: ["student-comms", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("parent_comms_log").select("*").eq("student_id", id).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const att = attendance.data ?? [];
    const total = att.length;
    const absent = att.filter((a) => a.status === "absent").length;
    const late = att.filter((a) => a.status === "late").length;
    const rate = total > 0 ? Math.round(((total - absent) / total) * 100) : 100;
    // by month
    const byMonth = new Map<string, { present: number; absent: number }>();
    att.forEach((a) => {
      const m = a.date.slice(0, 7);
      const cur = byMonth.get(m) ?? { present: 0, absent: 0 };
      if (a.status === "absent") cur.absent++;
      else cur.present++;
      byMonth.set(m, cur);
    });
    return { total, absent, late, rate, byMonth: Array.from(byMonth.entries()).slice(0, 6) };
  }, [attendance.data]);

  const del = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("students").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("تم حذف الطالب"); qc.invalidateQueries({ queryKey: ["students"] }); navigate({ to: "/students" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (student.isLoading) return <div className="text-muted-foreground">جاري التحميل...</div>;
  if (!student.data) return <div className="text-muted-foreground">الطالب غير موجود</div>;

  const s = student.data;
  const phoneDigits = s.parent_phone?.replace(/\D/g, "") ?? "";
  const waLink = phoneDigits ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(`السلام عليكم، بخصوص الطالب ${s.name}`)}` : null;
  const callLink = phoneDigits ? `tel:+${phoneDigits}` : null;

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
            {s.parent_phone && <p className="text-sm text-muted-foreground mt-1" dir="ltr">{s.parent_phone}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {waLink && (
              <a href={waLink} target="_blank" rel="noreferrer">
                <Button variant="outline" className="gap-2"><MessageSquare className="h-4 w-4" /> واتساب</Button>
              </a>
            )}
            {callLink && (
              <a href={callLink}>
                <Button variant="outline" className="gap-2"><Phone className="h-4 w-4" /> اتصال</Button>
              </a>
            )}
            {isMaster && (
              <Button variant="outline" className="gap-2 text-destructive" onClick={() => { if (confirm("حذف هذا الطالب نهائياً؟")) del.mutate(); }}>
                <Trash2 className="h-4 w-4" /> حذف
              </Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <Stat label="نقاط السلوك" value={s.behavior_points} icon={Star} tone={s.behavior_points >= 80 ? "success" : s.behavior_points >= 60 ? "warning" : "destructive"} />
          <Stat label="نسبة الحضور" value={`${stats.rate}%`} icon={TrendingUp} tone="primary" />
          <Stat label="مرات الغياب" value={stats.absent} icon={AlertTriangle} tone={stats.absent > 5 ? "destructive" : "muted"} />
          <Stat label="مرات التأخر" value={stats.late} icon={CalendarDays} tone="warning" />
        </div>
      </div>

      <Tabs defaultValue="behavior">
        <TabsList>
          <TabsTrigger value="behavior">السجل السلوكي ({incidents.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="attendance">الحضور ({stats.total})</TabsTrigger>
          <TabsTrigger value="comms">رسائل ولي الأمر ({comms.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="qr"><QrCode className="h-4 w-4 ml-1" /> بطاقة QR</TabsTrigger>
        </TabsList>

        <TabsContent value="qr" className="mt-4">
          <div className="max-w-sm mx-auto">
            <StudentQRBadge studentId={s.id} studentName={s.name} className={(s.classes as { name: string } | null)?.name} />
          </div>
        </TabsContent>

        <TabsContent value="behavior" className="space-y-2 mt-4">
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
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4 mt-4">
          {stats.byMonth.length > 0 && (
            <div className="glass rounded-xl p-4">
              <h4 className="text-sm font-semibold mb-3">آخر الشهور</h4>
              <div className="space-y-2">
                {stats.byMonth.map(([m, d]) => {
                  const tot = d.present + d.absent;
                  const pct = tot ? Math.round((d.present / tot) * 100) : 100;
                  return (
                    <div key={m} className="space-y-1">
                      <div className="flex justify-between text-xs"><span>{m}</span><span className="tabular-nums">{pct}% ({d.absent} غياب)</span></div>
                      <div className="h-2 rounded bg-white/5 overflow-hidden"><div className="h-full bg-success" style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="space-y-1">
            {attendance.data?.slice(0, 50).map((a, i) => (
              <div key={i} className="flex items-center justify-between text-sm glass rounded-lg px-3 py-2">
                <span>{a.date} · الحصة {a.period}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${a.status === "absent" ? "bg-destructive/20 text-destructive" : a.status === "late" ? "bg-warning/20 text-warning" : "bg-success/20 text-success"}`}>
                  {a.status === "absent" ? "غائب" : a.status === "late" ? "متأخر" : "حاضر"}
                </span>
              </div>
            ))}
            {attendance.data?.length === 0 && <p className="text-muted-foreground text-sm text-center py-6">لا توجد سجلات حضور</p>}
          </div>
        </TabsContent>

        <TabsContent value="comms" className="space-y-2 mt-4">
          {comms.data?.map((c) => (
            <div key={c.id} className="glass rounded-xl p-3">
              <div className="flex justify-between text-xs text-muted-foreground"><span>{c.type}</span><span>{new Date(c.created_at).toLocaleString("ar")}</span></div>
              {c.message && <p className="text-sm mt-1 whitespace-pre-wrap">{c.message}</p>}
            </div>
          ))}
          {comms.data?.length === 0 && <p className="text-muted-foreground text-sm text-center py-6">لا يوجد سجل مراسلات</p>}
        </TabsContent>
      </Tabs>
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
