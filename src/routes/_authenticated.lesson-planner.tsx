import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Copy, Save, Trash2, Lightbulb, ListChecks, BookOpen, Info } from "lucide-react";
import { toast } from "sonner";
import { generateLessonPlan, generateTeachingIdeas } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/lesson-planner")({
  component: LessonPlannerPage,
});

const PROMPT_GUIDE = [
  { title: "كن محدداً", body: "بدل من \"درس عن النباتات\" اكتب \"درس عن أجزاء النبات للصف الثالث الابتدائي - 45 دقيقة\"." },
  { title: "اذكر مستوى الطلاب", body: "حدد المرحلة والصف لأن الأسلوب يختلف بين ابتدائي ومتوسط وثانوي." },
  { title: "حدد الأهداف", body: "اكتب الأهداف المرادة بصياغة سلوكية: \"يميّز الطالب بين...\"." },
  { title: "أضف القيود والاحتياجات", body: "مثل: عدد الطلاب، الموارد المتاحة (سبورة ذكية، طابعة)، أو احتياجات خاصة." },
  { title: "اطلب نوع المخرج", body: "خطة كاملة؟ أنشطة فقط؟ أوراق عمل؟ كن واضحاً في طلبك." },
];

function LessonPlannerPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState(45);
  const [objectives, setObjectives] = useState("");
  const [extra, setExtra] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const planFn = useServerFn(generateLessonPlan);
  const ideasFn = useServerFn(generateTeachingIdeas);

  const myPlans = useQuery({
    queryKey: ["my-lesson-plans", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("lesson_plans").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  async function gen(kind: "plan" | "activities" | "exercises" | "ideas") {
    if (!subject || !topic) return toast.error("أدخل المادة والموضوع على الأقل");
    setLoading(true); setOutput("");
    try {
      if (kind === "plan") {
        const r = await planFn({ data: { subject, grade, topic, duration, objectives, extra } });
        setOutput(r.text);
      } else {
        const r = await ideasFn({ data: { subject, grade, topic, kind: kind as "activities" | "exercises" | "ideas" } });
        setOutput(r.text);
      }
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lesson_plans").insert({
        teacher_id: user!.id, subject, grade: grade || null, topic, duration_minutes: duration,
        objectives: objectives || null, content: output,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم حفظ الخطة"); qc.invalidateQueries({ queryKey: ["my-lesson-plans"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("lesson_plans").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-lesson-plans"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold flex items-center gap-2"><Sparkles className="h-7 w-7 text-accent" /> مخطط الدروس الذكي</h2>
        <p className="text-muted-foreground text-sm mt-1">اكتب تفاصيل الدرس، ودع الذكاء الاصطناعي يصمم لك خطة جاهزة للتطبيق.</p>
      </div>

      <details className="glass rounded-xl p-4">
        <summary className="cursor-pointer font-semibold flex items-center gap-2"><Info className="h-4 w-4 text-primary" /> كيف تكتب طلباً جيداً؟</summary>
        <div className="mt-3 space-y-2 text-sm">
          {PROMPT_GUIDE.map((g, i) => (
            <div key={i} className="border-r-2 border-primary/40 pr-3">
              <div className="font-semibold">{i + 1}. {g.title}</div>
              <div className="text-muted-foreground text-xs">{g.body}</div>
            </div>
          ))}
        </div>
      </details>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-2xl p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>المادة *</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="رياضيات" /></div>
            <div><Label>الصف</Label><Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="الثالث الابتدائي" /></div>
          </div>
          <div><Label>الموضوع *</Label><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="جمع الأعداد ضمن 1000" /></div>
          <div><Label>المدة (دقيقة)</Label><Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></div>
          <div><Label>أهداف مقترحة (اختياري)</Label><Textarea rows={2} value={objectives} onChange={(e) => setObjectives(e.target.value)} placeholder="مثال: يميّز الطالب بين..." /></div>
          <div><Label>ملاحظات إضافية (اختياري)</Label><Textarea rows={2} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="عدد الطلاب، الموارد، احتياجات خاصة..." /></div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button onClick={() => gen("plan")} disabled={loading} className="gradient-primary text-primary-foreground gap-2"><BookOpen className="h-4 w-4" /> خطة كاملة</Button>
            <Button onClick={() => gen("activities")} disabled={loading} variant="outline" className="gap-2"><Lightbulb className="h-4 w-4" /> أنشطة</Button>
            <Button onClick={() => gen("exercises")} disabled={loading} variant="outline" className="gap-2"><ListChecks className="h-4 w-4" /> تمارين</Button>
            <Button onClick={() => gen("ideas")} disabled={loading} variant="outline" className="gap-2"><Sparkles className="h-4 w-4" /> أفكار إبداعية</Button>
          </div>
        </div>

        <div className="glass rounded-2xl p-5 space-y-3 min-h-[400px]">
          {loading && <div className="text-center text-muted-foreground py-10">جاري التوليد...</div>}
          {!loading && !output && <div className="text-center text-muted-foreground py-10">سيظهر الناتج هنا — املأ الحقول واضغط على أحد الأزرار.</div>}
          {output && (
            <>
              <Textarea rows={20} value={output} onChange={(e) => setOutput(e.target.value)} className="font-medium" dir="auto" />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(output); toast.success("تم النسخ"); }} className="gap-1"><Copy className="h-4 w-4" /> نسخ</Button>
                <Button variant="outline" onClick={() => window.print()} className="gap-1">طباعة</Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-1 gradient-primary text-primary-foreground"><Save className="h-4 w-4" /> حفظ</Button>
              </div>
            </>
          )}
        </div>
      </div>

      {myPlans.data && myPlans.data.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold mb-3">خططي المحفوظة</h3>
          <div className="space-y-2">
            {myPlans.data.map((p) => (
              <details key={p.id} className="glass rounded-xl p-4">
                <summary className="cursor-pointer flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">{p.subject} — {p.topic}</div>
                    <div className="text-xs text-muted-foreground">{p.grade ?? ""} · {new Date(p.created_at).toLocaleDateString("ar")}</div>
                  </div>
                  <button onClick={(e) => { e.preventDefault(); if (confirm("حذف هذه الخطة؟")) del.mutate(p.id); }} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </summary>
                <pre className="mt-3 whitespace-pre-wrap text-sm font-medium" dir="auto">{p.content}</pre>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
