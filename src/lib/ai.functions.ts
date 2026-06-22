import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  studentName: z.string().min(1),
  className: z.string().optional(),
  incidentType: z.enum(["reward", "infraction"]),
  severity: z.enum(["mild", "moderate", "serious"]).optional(),
  note: z.string().optional(),
  behaviorPoints: z.number().optional(),
});

export const generateParentMessage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI غير مهيأ");

    const sysPrompt = `أنت مرشد سلوكي مدرسي. ولي الأمر عربي. اكتب رسالة واتساب قصيرة (٤-٦ جمل) لولي الأمر باللهجة الفصحى المهذبة، بصيغة المتكلم عن إدارة المدرسة. ابدأ بـ"السلام عليكم". لا تستعمل رموز تعبيرية كثيرة. ثم اكتب سطراً مستقلاً بعنوان "الإجراء المقترح:" يحتوي توصية عملية واحدة للمعلم/الإدارة.`;

    const userPrompt = `الطالب: ${data.studentName}${data.className ? ` (${data.className})` : ""}
نوع الواقعة: ${data.incidentType === "reward" ? "مكافأة/إيجابي" : "مخالفة سلوكية"}
${data.severity ? `الخطورة: ${data.severity}\n` : ""}${typeof data.behaviorPoints === "number" ? `نقاط السلوك الحالية: ${data.behaviorPoints}\n` : ""}الملاحظة: ${data.note || "—"}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (res.status === 429) throw new Error("تم تجاوز الحد المسموح، حاول لاحقاً");
    if (res.status === 402) throw new Error("نفدت أرصدة الذكاء الاصطناعي");
    if (!res.ok) throw new Error(`AI error ${res.status}`);
    const json = await res.json();
    const text: string = json.choices?.[0]?.message?.content ?? "";
    return { text };
  });
