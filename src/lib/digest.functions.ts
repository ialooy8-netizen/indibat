import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function callAI(messages: Array<{ role: string; content: string }>) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI غير مهيأ");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
  });
  if (res.status === 429) throw new Error("تم تجاوز الحد المسموح");
  if (res.status === 402) throw new Error("نفدت أرصدة الذكاء الاصطناعي");
  if (!res.ok) throw new Error(`AI error ${res.status}`);
  const j = await res.json();
  return (j.choices?.[0]?.message?.content ?? "") as string;
}

export const generateWeeklyDigest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const to = new Date();
    const from = new Date(); from.setDate(from.getDate() - 7);
    const fromISO = from.toISOString().slice(0, 10);
    const toISO = to.toISOString().slice(0, 10);

    const [absAll, incAll, classes, students] = await Promise.all([
      supabase.from("attendance").select("student_id,status,students(class_id,classes(name))").gte("date", fromISO).lte("date", toISO),
      supabase.from("behavior_incidents").select("student_id,type,points,severity,students(name,class_id,classes(name))").gte("created_at", fromISO),
      supabase.from("classes").select("id,name"),
      supabase.from("students").select("id,name,behavior_points,classes(name)"),
    ]);

    // per-class aggregation
    const byClass = new Map<string, { name: string; abs: number; late: number; rewards: number; infractions: number }>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (absAll.data ?? []).forEach((r: any) => {
      const cls = r.students?.classes?.name ?? "—";
      const cur = byClass.get(cls) ?? { name: cls, abs: 0, late: 0, rewards: 0, infractions: 0 };
      if (r.status === "absent") cur.abs++; else if (r.status === "late") cur.late++;
      byClass.set(cls, cur);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (incAll.data ?? []).forEach((r: any) => {
      const cls = r.students?.classes?.name ?? "—";
      const cur = byClass.get(cls) ?? { name: cls, abs: 0, late: 0, rewards: 0, infractions: 0 };
      if (r.type === "reward") cur.rewards++; else cur.infractions++;
      byClass.set(cls, cur);
    });

    const totalStudents = students.data?.length ?? 0;
    const avgBehavior = totalStudents
      ? Math.round((students.data ?? []).reduce((s, x) => s + (x.behavior_points ?? 0), 0) / totalStudents)
      : 0;

    const summary = Array.from(byClass.values())
      .sort((a, b) => (b.abs + b.infractions) - (a.abs + a.infractions))
      .slice(0, 10)
      .map((c) => `${c.name}: غياب ${c.abs}، تأخر ${c.late}، مخالفات ${c.infractions}، مكافآت ${c.rewards}`)
      .join("\n");

    const sys = `أنت مساعد إداري في مدرسة بحرينية. اكتب ملخصاً أسبوعياً موجزاً (٦-٨ نقاط) للمدير بالعربية الفصحى. غطِ: 1) الحالة العامة 2) أعلى ٣ صفوف مقلقة 3) أفضل ٣ صفوف 4) نمط ملحوظ (غياب/تأخر/سلوك) 5) توصيات عملية للأسبوع القادم. لا مقدمات طويلة، اذهب مباشرة للنقاط. استخدم رموز • للتعداد.`;
    const usr = `الفترة: ${fromISO} → ${toISO}
عدد الطلاب: ${totalStudents} | متوسط السلوك: ${avgBehavior}
عدد الصفوف: ${classes.data?.length ?? 0}

بيانات الصفوف:
${summary || "لا توجد بيانات كافية"}`;
    const text = await callAI([{ role: "system", content: sys }, { role: "user", content: usr }]);
    return { text, from: fromISO, to: toISO, avgBehavior, totalStudents };
  });
