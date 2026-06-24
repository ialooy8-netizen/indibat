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
    const sys = `أنت مرشد سلوكي مدرسي في مدرسة بحرينية تتبع وزارة التربية والتعليم. ولي الأمر بحريني. اكتب رسالة واتساب قصيرة (٤-٦ جمل) باللغة العربية الفصحى المهذبة المناسبة للسياق البحريني. ابدأ بـ"السلام عليكم ورحمة الله وبركاته" دون مبالغة في الرموز. ثم سطر بعنوان "الإجراء المقترح:" بتوصية عملية واحدة قابلة للتطبيق.`;
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
    const sys = `أنت خبير تربوي بحريني متخصص في تصميم خطط الدروس وفق منهج وزارة التربية والتعليم في مملكة البحرين، ومتوافق مع وثيقة معايير المناهج البحرينية ومشروع مدارس المستقبل.
- استخدم المصطلحات والمفردات التربوية المعتمدة في البحرين.
- اربط الأمثلة بالبيئة البحرينية (المعالم، التراث، الجغرافيا، الاقتصاد، الرؤية الاقتصادية 2030).
- راعِ المرحلة الدراسية (ابتدائي/إعدادي/ثانوي) وتنوع مستويات بلوم.
- أهداف سلوكية قابلة للقياس + استراتيجيات تعلّم نشط + تقويم متدرّج + تكامل التقنية.
- استخدم صيغة Markdown بالهيكل التالي:

# عنوان الدرس
## نظرة عامة
- المادة / الصف / المدة / المنهج: وزارة التربية والتعليم — مملكة البحرين

## الأهداف التعليمية
- صياغة سلوكية قابلة للقياس مرتبطة بمعايير المنهج البحريني

## المفاهيم والمفردات الأساسية

## التمهيد (5 دقائق)
نشاط تشويقي يربط بحياة الطالب البحريني.

## العرض والشرح
خطوات + استراتيجيات تعلم نشط (تعلم تعاوني، تفكير ناقد، حل المشكلات).

## النشاط التطبيقي
أنشطة فردية + جماعية + مهارات القرن 21.

## التقويم
- أسئلة متعددة المستويات (تذكر، فهم، تطبيق، تحليل) + إجابات نموذجية.

## الواجب المنزلي

## مصادر وأدوات
اربط بكتاب الطالب البحريني والمنصات الرقمية للوزارة (EduNet، Microsoft Teams) عند الإمكان.`;
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
    const sys = `أنت خبير تربوي بحريني. اقترح ${kindAr} متوافقة مع منهج وزارة التربية والتعليم البحريني وقابلة للتطبيق فوراً في الفصل. اربطها بالبيئة البحرينية عند الإمكان. اكتب 5-7 أفكار، كل فكرة بعنوان قصير ثم وصف مختصر (2-3 أسطر) وأدوات مطلوبة.`;
    const user = `المادة: ${data.subject}${data.grade ? ` — الصف: ${data.grade} (المنهج البحريني)` : ""}\nالموضوع: ${data.topic}`;
    const text = await callAI([{ role: "system", content: sys }, { role: "user", content: user }]);
    return { text };
  });
