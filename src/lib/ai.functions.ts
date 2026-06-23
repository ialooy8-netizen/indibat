import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ParentMsgInput = z.object({
  studentName: z.string().min(1),
  className: z.string().optional(),
  incidentType: z.enum(["reward", "infraction"]),
  severity: z.enum(["mild", "moderate", "serious"]).optional(),
  note: z.string().optional(),
  behaviorPoints: z.number().optional(),
});

async function callAI(messages: Array<{ role: string; content: string }>) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI غير مهيأ");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
  });
  if (res.status === 429) throw new Error("تم تجاوز الحد المسموح، حاول لاحقاً");
  if (res.status === 402) throw new Error("نفدت أرصدة الذكاء الاصطناعي");
  if (!res.ok) throw new Error(`AI error ${res.status}`);
  const json = await res.json();
  return (json.choices?.[0]?.message?.content ?? "") as string;
}

export const generateParentMessage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ParentMsgInput.parse(data))
  .handler(async ({ data }) => {
    const sys = `أنت مرشد سلوكي مدرسي. ولي الأمر عربي. اكتب رسالة واتساب قصيرة (٤-٦ جمل) لولي الأمر باللهجة الفصحى المهذبة. ابدأ بـ"السلام عليكم". لا تستعمل رموز كثيرة. ثم سطر بعنوان "الإجراء المقترح:" بتوصية عملية واحدة.`;
    const user = `الطالب: ${data.studentName}${data.className ? ` (${data.className})` : ""}
نوع الواقعة: ${data.incidentType === "reward" ? "مكافأة/إيجابي" : "مخالفة"}
${data.severity ? `الخطورة: ${data.severity}\n` : ""}${typeof data.behaviorPoints === "number" ? `نقاط السلوك: ${data.behaviorPoints}\n` : ""}الملاحظة: ${data.note || "—"}`;
    const text = await callAI([{ role: "system", content: sys }, { role: "user", content: user }]);
    return { text };
  });

const LessonInput = z.object({
  subject: z.string().min(1),
  grade: z.string().optional(),
  topic: z.string().min(1),
  duration: z.number().int().positive().default(45),
  objectives: z.string().optional(),
  extra: z.string().optional(),
});

export const generateLessonPlan = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => LessonInput.parse(d))
  .handler(async ({ data }) => {
    const sys = `أنت خبير تعليمي خبير في تصميم خطط الدروس بالمنهج السعودي/الخليجي. تكتب خطة عملية واضحة جاهزة للتطبيق في الفصل. التزم بهذا الهيكل بصيغة Markdown:

# عنوان الدرس
## نظرة عامة
- المادة / الصف / المدة

## الأهداف التعليمية
- بصياغة سلوكية قابلة للقياس

## المفردات والمفاهيم الأساسية

## التمهيد (5 دقائق)
نشاط تشويقي يربط بحياة الطالب.

## العرض والشرح
خطوات مرتبة + استراتيجيات تعليمية متنوعة.

## النشاط التطبيقي
أنشطة فردية + جماعية + مهارات تفكير عليا.

## التقويم
- أسئلة تقويمية (متعددة المستويات) + كيفية تصحيحها.

## الواجب المنزلي

## مصادر وأدوات`;
    const user = `المادة: ${data.subject}
${data.grade ? `الصف: ${data.grade}\n` : ""}الموضوع: ${data.topic}
المدة: ${data.duration} دقيقة
${data.objectives ? `أهداف مقترحة: ${data.objectives}\n` : ""}${data.extra ? `ملاحظات إضافية: ${data.extra}` : ""}`;
    const text = await callAI([{ role: "system", content: sys }, { role: "user", content: user }]);
    return { text };
  });

const ActivitiesInput = z.object({
  subject: z.string().min(1),
  grade: z.string().optional(),
  topic: z.string().min(1),
  kind: z.enum(["activities", "exercises", "ideas"]),
});

export const generateTeachingIdeas = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ActivitiesInput.parse(d))
  .handler(async ({ data }) => {
    const kindAr = data.kind === "activities" ? "أنشطة صفية تفاعلية"
      : data.kind === "exercises" ? "تمارين متدرجة (سهلة → متوسطة → متقدمة)"
      : "أفكار إبداعية للحصة";
    const sys = `أنت خبير تعليمي. اقترح ${kindAr} عملية وقابلة للتطبيق فوراً في الفصل. اكتب 5-7 أفكار، كل فكرة بعنوان قصير ثم وصف مختصر (2-3 أسطر) وأدوات مطلوبة.`;
    const user = `المادة: ${data.subject}${data.grade ? ` — الصف: ${data.grade}` : ""}\nالموضوع: ${data.topic}`;
    const text = await callAI([{ role: "system", content: sys }, { role: "user", content: user }]);
    return { text };
  });
