import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Brain, MessageSquare, ArrowLeft, Sparkles, Copy, TrendingDown, Activity, CalendarX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { generateParentMessage } from "@/lib/ai.functions";
import { toast } from "sonner";
import { FeatureHelp } from "@/components/app/FeatureHelp";
import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";

export const Route = createFileRoute("/_authenticated/predictor")({
  component: PredictorPage,
});

type StudentRow = {
  id: string;
  name: string;
  behavior_points: number;
  parent_phone: string | null;
  classes: { name: string } | null;
};

type RiskStudent = StudentRow & {
  absent: number;
  late: number;
  totalDays: number;
  attendanceRate: number; // 0..100
  incidents30: number;
  riskScore: number; // 0..100 (higher = worse)
  tier: "critical" | "high" | "moderate" | "watch";
};

const TIER_META = {
  critical: { label: "حرج", cls: "bg-destructive/20 text-destructive border-destructive/40", bar: "bg-destructive" },
  high:     { label: "عالي",  cls: "bg-warning/25 text-warning border-warning/40", bar: "bg-warning" },
  moderate: { label: "متوسط", cls: "bg-warning/10 text-warning border-warning/30", bar: "bg-warning/60" },
  watch:    { label: "مراقبة", cls: "bg-primary/15 text-primary border-primary/30", bar: "bg-primary" },
} as const;

function tierFor(score: number): RiskStudent["tier"] {
  if (score >= 70) return "critical";
  if (score >= 50) return "high";
  if (score >= 30) return "moderate";
  return "watch";
}

function PredictorPage() {
  const [coach, setCoach] = useState<RiskStudent | null>(null);
  const [tab, setTab] = useState<"all" | "critical" | "high">("all");

  const from30 = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }, []);

  const data = useQuery({
    queryKey: ["predictor-risk", from30],
    queryFn: async () => {
      const [studentsRes, attRes, incRes] = await Promise.all([
        supabase.from("students").select("id, name, behavior_points, parent_phone, classes(name)").order("behavior_points", { ascending: true }),
        supabase.from("attendance").select("student_id, status, date").gte("date", from30),
        supabase.from("behavior_incidents").select("student_id, type, points").gte("created_at", from30),
      ]);
      if (studentsRes.error) throw studentsRes.error;
      const students = (studentsRes.data ?? []) as unknown as StudentRow[];

      const aMap = new Map<string, { a: number; l: number; t: number }>();
      for (const r of attRes.data ?? []) {
        const cur = aMap.get(r.student_id) ?? { a: 0, l: 0, t: 0 };
        cur.t += 1;
        if (r.status === "absent") cur.a += 1;
        else if (r.status === "late") cur.l += 1;
        aMap.set(r.student_id, cur);
      }

      const iMap = new Map<string, number>();
      for (const r of incRes.data ?? []) {
        if (r.type !== "infraction") continue;
        iMap.set(r.student_id, (iMap.get(r.student_id) ?? 0) + 1);
      }

      const out: RiskStudent[] = students.map((s) => {
        const a = aMap.get(s.id) ?? { a: 0, l: 0, t: 0 };
        const attendanceRate = a.t > 0 ? Math.round(((a.t - a.a) / a.t) * 100) : 100;
        const behaviorScore = Math.max(0, Math.min(100, 100 - (s.behavior_points ?? 100))); // worse behavior => higher
        const attendanceScore = Math.max(0, 100 - attendanceRate) + Math.min(20, a.l * 3); // absences + late penalty
        const incidentScore = Math.min(40, (iMap.get(s.id) ?? 0) * 8);
        // Weighted: behavior 45%, attendance 40%, incidents 15%
        const risk = Math.min(100, Math.round(behaviorScore * 0.45 + attendanceScore * 0.4 + incidentScore * 0.15));
        return {
          ...s,
          absent: a.a, late: a.l, totalDays: a.t,
          attendanceRate,
          incidents30: iMap.get(s.id) ?? 0,
          riskScore: risk,
          tier: tierFor(risk),
        };
      }).filter((s) => s.riskScore >= 20)
        .sort((a, b) => b.riskScore - a.riskScore);
      return out;
    },
  });

  const filtered = useMemo(() => {
    const rows = data.data ?? [];
    if (tab === "critical") return rows.filter((r) => r.tier === "critical");
    if (tab === "high") return rows.filter((r) => r.tier === "high" || r.tier === "critical");
    return rows;
  }, [data.data, tab]);

  const counts = useMemo(() => {
    const rows = data.data ?? [];
    return {
      critical: rows.filter((r) => r.tier === "critical").length,
      high: rows.filter((r) => r.tier === "high").length,
      moderate: rows.filter((r) => r.tier === "moderate").length,
      watch: rows.filter((r) => r.tier === "watch").length,
    };
  }, [data.data]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold flex items-center gap-2">
          <Brain className="h-7 w-7 text-accent" /> المتنبئ السلوكي الذكي
          <FeatureHelp title="المتنبئ السلوكي الذكي">
            <p>مؤشر خطر لكل طالب يجمع بين ثلاثة عوامل خلال آخر 30 يوم:</p>
            <ul className="list-disc pr-5 space-y-1">
              <li>سلوك (45%) — بناءً على نقاط السلوك المتراكمة.</li>
              <li>حضور (40%) — نسبة الغياب مع عقوبة على التأخر المتكرر.</li>
              <li>مخالفات (15%) — عدد الوقائع السلوكية المسجلة.</li>
            </ul>
            <p>الطالب يظهر هنا فقط عند تجاوز عتبة 20/100 لتخفيف الضجيج.</p>
          </FeatureHelp>
        </h2>
        <p className="text-muted-foreground text-sm mt-1">نموذج مركّب يجمع السلوك والحضور والمخالفات</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <TierCard tier="critical" count={counts.critical} icon={TrendingDown} />
        <TierCard tier="high" count={counts.high} icon={Activity} />
        <TierCard tier="moderate" count={counts.moderate} icon={CalendarX} />
        <TierCard tier="watch" count={counts.watch} icon={Brain} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="all">الكل</TabsTrigger>
          <TabsTrigger value="high">عالي+حرج</TabsTrigger>
          <TabsTrigger value="critical">حرج فقط</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {data.isLoading && <div className="glass rounded-2xl p-10 text-center text-muted-foreground">جاري التحليل...</div>}
          {!data.isLoading && filtered.length === 0 && (
            <div className="glass rounded-2xl p-10 text-center text-muted-foreground">🎉 لا يوجد طلاب ضمن هذه الفئة حالياً.</div>
          )}
          <div className="space-y-3">
            {filtered.map((s) => {
              const meta = TIER_META[s.tier];
              const msg = `السلام عليكم، نود إعلامكم بأن مستوى الأداء لدى الطالب ${s.name} يستدعي الاهتمام. نرجو التواصل مع إدارة المدرسة.`;
              const wa = s.parent_phone ? `https://wa.me/${s.parent_phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}` : null;
              return (
                <div key={s.id} className="glass rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[180px]">
                      <Link to="/students/$id" params={{ id: s.id }} className="font-semibold hover:text-primary">{s.name}</Link>
                      <p className="text-xs text-muted-foreground">{s.classes?.name ?? "—"}</p>
                    </div>
                    <div className={`text-xs font-bold px-3 py-1 rounded-full border ${meta.cls}`}>{meta.label}</div>
                    <div className="text-center">
                      <div className="text-2xl font-extrabold tabular-nums leading-none">{s.riskScore}<span className="text-xs text-muted-foreground">/100</span></div>
                      <div className="text-[10px] text-muted-foreground">مؤشر الخطر</div>
                    </div>
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => setCoach(s)}>
                      <Sparkles className="h-4 w-4 text-accent" /> مرشد AI
                    </Button>
                    {wa && (
                      <a href={wa} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline" className="gap-2"><MessageSquare className="h-4 w-4" /> واتساب</Button>
                      </a>
                    )}
                    <Link to="/students/$id" params={{ id: s.id }}>
                      <Button size="sm" variant="ghost" className="gap-1">التفاصيل <ArrowLeft className="h-4 w-4" /></Button>
                    </Link>
                  </div>
                  <Progress value={s.riskScore} className="h-1.5" />
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <Metric label="السلوك" value={`${s.behavior_points}`} tone={s.behavior_points < 50 ? "bad" : s.behavior_points < 70 ? "warn" : "ok"} />
                    <Metric label="الحضور (30ي)" value={`${s.attendanceRate}%`} sub={`${s.absent} غياب · ${s.late} تأخر`} tone={s.attendanceRate < 80 ? "bad" : s.attendanceRate < 90 ? "warn" : "ok"} />
                    <Metric label="مخالفات (30ي)" value={`${s.incidents30}`} tone={s.incidents30 >= 3 ? "bad" : s.incidents30 >= 1 ? "warn" : "ok"} />
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <AiCoachDialog student={coach} onClose={() => setCoach(null)} />
    </div>
  );
}

function TierCard({ tier, count, icon: Icon }: { tier: keyof typeof TIER_META; count: number; icon: React.ComponentType<{ className?: string }> }) {
  const meta = TIER_META[tier];
  const data = [{ name: meta.label, value: count, fill: `var(--${tier === "critical" ? "destructive" : tier === "high" ? "warning" : tier === "moderate" ? "warning" : "primary"})` }];
  return (
    <div className="glass rounded-2xl p-4 flex items-center gap-3">
      <div className="relative w-16 h-16 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" domain={[0, Math.max(count, 10)]} tick={false} />
            <RadialBar dataKey="value" background cornerRadius={4} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center text-lg font-extrabold tabular-nums">{count}</div>
      </div>
      <div>
        <div className={`text-xs font-bold inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${meta.cls}`}>
          <Icon className="h-3 w-3" /> {meta.label}
        </div>
        <div className="text-[10px] text-muted-foreground mt-1">طالب في هذه الفئة</div>
      </div>
    </div>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: "ok" | "warn" | "bad" }) {
  const cls = tone === "bad" ? "text-destructive" : tone === "warn" ? "text-warning" : "text-success";
  return (
    <div className="rounded-lg bg-white/5 p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`text-sm font-bold tabular-nums ${cls}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function AiCoachDialog({ student, onClose }: { student: RiskStudent | null; onClose: () => void }) {
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const gen = useServerFn(generateParentMessage);

  async function run() {
    if (!student) return;
    setLoading(true);
    setDraft("");
    try {
      const context = `مؤشر الخطر: ${student.riskScore}/100. الحضور: ${student.attendanceRate}% (غياب ${student.absent}, تأخر ${student.late}). مخالفات: ${student.incidents30}. ${note ? "ملاحظة: " + note : ""}`;
      const res = await gen({
        data: {
          studentName: student.name,
          className: student.classes?.name,
          incidentType: "infraction",
          severity: student.tier === "critical" ? "serious" : student.tier === "high" ? "moderate" : "mild",
          note: context,
          behaviorPoints: student.behavior_points,
        },
      });
      setDraft(res.text);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function copyDraft() { navigator.clipboard.writeText(draft); toast.success("تم النسخ"); }
  function sendWa() {
    if (!student?.parent_phone) return toast.error("لا يوجد رقم جوال");
    window.open(`https://wa.me/${student.parent_phone.replace(/\D/g, "")}?text=${encodeURIComponent(draft)}`, "_blank");
  }

  return (
    <Dialog open={!!student} onOpenChange={(o) => !o && (onClose(), setDraft(""), setNote(""))}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-accent" /> مرشد سلوكي — {student?.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {student && (
            <div className="glass rounded-lg p-3 text-xs space-y-1">
              <div>مؤشر الخطر: <span className="font-bold">{student.riskScore}/100</span></div>
              <div>الحضور: <span className="font-bold">{student.attendanceRate}%</span> · غياب {student.absent} · تأخر {student.late}</div>
              <div>مخالفات آخر 30 يوم: <span className="font-bold">{student.incidents30}</span></div>
            </div>
          )}
          <div>
            <label className="text-sm font-medium">ملاحظة إضافية (اختياري)</label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً: يتغيّب أيام الأحد..." />
          </div>
          <Button onClick={run} disabled={loading} className="w-full gradient-primary text-primary-foreground gap-2">
            <Sparkles className="h-4 w-4" /> {loading ? "جاري التوليد..." : "توليد رسالة لولي الأمر"}
          </Button>
          {draft && (
            <div className="space-y-2">
              <Textarea rows={10} value={draft} onChange={(e) => setDraft(e.target.value)} className="font-medium" />
              <div className="flex gap-2">
                <Button variant="outline" onClick={copyDraft} className="flex-1 gap-1"><Copy className="h-4 w-4" /> نسخ</Button>
                {student?.parent_phone && <Button onClick={sendWa} className="flex-1 gap-1 bg-accent text-accent-foreground"><MessageSquare className="h-4 w-4" /> واتساب</Button>}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
