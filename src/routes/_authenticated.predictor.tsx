import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Brain, MessageSquare, ArrowLeft, Sparkles, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { generateParentMessage } from "@/lib/ai.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/predictor")({
  component: PredictorPage,
});

function severity(points: number) {
  if (points < 40) return { label: "حرج", chip: "bg-destructive/20 text-destructive" };
  if (points < 60) return { label: "عالي", chip: "bg-warning/20 text-warning" };
  return { label: "متوسط", chip: "bg-warning/10 text-warning" };
}

type RiskRow = {
  id: string;
  name: string;
  behavior_points: number;
  parent_phone: string | null;
  classes: { name: string } | null;
};

function PredictorPage() {
  const [coach, setCoach] = useState<RiskRow | null>(null);
  const atRisk = useQuery<RiskRow[]>({
    queryKey: ["at-risk"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, name, behavior_points, parent_phone, classes(name)")
        .lt("behavior_points", 70)
        .order("behavior_points", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as RiskRow[];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold flex items-center gap-2"><Brain className="h-7 w-7 text-accent" /> المتنبئ السلوكي</h2>
        <p className="text-muted-foreground text-sm mt-1">طلاب تحت خط الإنذار (نقاط السلوك أقل من 70)</p>
      </div>

      {atRisk.isLoading && <div className="glass rounded-2xl p-10 text-center text-muted-foreground">جاري التحليل...</div>}

      {!atRisk.isLoading && atRisk.data?.length === 0 && (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
          🎉 لا يوجد طلاب في منطقة الخطر حالياً.
        </div>
      )}

      <div className="space-y-3">
        {atRisk.data?.map((s) => {
          const sev = severity(s.behavior_points);
          const msg = `السلام عليكم، نود إعلامكم بأن مستوى السلوك لدى الطالب ${s.name} يستدعي الاهتمام. نرجو التواصل مع إدارة المدرسة.`;
          const wa = s.parent_phone ? `https://wa.me/${s.parent_phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}` : null;
          return (
            <div key={s.id} className="glass rounded-xl p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <Link to="/students/$id" params={{ id: s.id }} className="font-semibold hover:text-primary">{s.name}</Link>
                <p className="text-xs text-muted-foreground">{s.classes?.name ?? ""}</p>
              </div>
              <div className={`text-xs font-bold px-3 py-1 rounded-full ${sev.chip}`}>{sev.label}</div>
              <div className="text-2xl font-bold tabular-nums">{s.behavior_points}</div>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => setCoach(s)}>
                <Sparkles className="h-4 w-4 text-accent" /> مرشد AI
              </Button>
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

      <AiCoachDialog student={coach} onClose={() => setCoach(null)} />
    </div>
  );
}

function AiCoachDialog({ student, onClose }: { student: RiskRow | null; onClose: () => void }) {
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const gen = useServerFn(generateParentMessage);

  async function run() {
    if (!student) return;
    setLoading(true);
    setDraft("");
    try {
      const res = await gen({
        data: {
          studentName: student.name,
          className: student.classes?.name,
          incidentType: "infraction",
          severity: student.behavior_points < 40 ? "serious" : student.behavior_points < 60 ? "moderate" : "mild",
          note,
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

  function copyDraft() {
    navigator.clipboard.writeText(draft);
    toast.success("تم النسخ");
  }

  function sendWa() {
    if (!student?.parent_phone) return toast.error("لا يوجد رقم جوال");
    const phone = student.parent_phone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(draft)}`, "_blank");
  }

  return (
    <Dialog open={!!student} onOpenChange={(o) => !o && (onClose(), setDraft(""), setNote(""))}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-accent" /> مرشد سلوكي — {student?.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">ملاحظة أو واقعة (اختياري)</label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً: تأخر متكرر، إزعاج في الفصل..." />
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
