import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function assertMaster(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "master" });
  if (error || !data) throw new Error("غير مصرّح");
}

const DEMO_CLASSES = [
  { name: "تجريبي 5/أ", grade: "ابتدائي" },
  { name: "تجريبي 6/ب", grade: "ابتدائي" },
];

const DEMO_STUDENTS_A: Array<[string, string, string]> = [
  ["أحمد بن سالم", "والد أحمد", "966500000001"],
  ["خالد العتيبي", "أم خالد", "966500000002"],
  ["عبدالله الزهراني", "والد عبدالله", "966500000003"],
  ["محمد القحطاني", "أم محمد", "966500000004"],
  ["سعد الدوسري", "والد سعد", "966500000005"],
  ["فهد الشمري", "أم فهد", "966500000006"],
  ["يوسف العنزي", "والد يوسف", "966500000007"],
];

const DEMO_STUDENTS_B: Array<[string, string, string]> = [
  ["نورة الحارثي", "والد نورة", "966500000008"],
  ["سارة المطيري", "والد سارة", "966500000009"],
  ["مريم البلوي", "والد مريم", "966500000010"],
  ["هند السبيعي", "والد هند", "966500000011"],
  ["لطيفة الغامدي", "والد لطيفة", "966500000012"],
];

export const seedDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMaster(context as any);
    const sb = context.supabase as any;

    await sb.from("students").delete().eq("is_demo", true);
    await sb.from("classes").delete().eq("is_demo", true);

    const { data: classes, error: ce } = await sb.from("classes")
      .insert(DEMO_CLASSES.map((c) => ({ ...c, is_demo: true })))
      .select("id, name");
    if (ce) throw new Error(ce.message);

    const classA = classes.find((c: any) => c.name.includes("5/أ"));
    const classB = classes.find((c: any) => c.name.includes("6/ب"));

    const rows: any[] = [
      ...DEMO_STUDENTS_A.map(([name, pn, ph], i) => ({
        name, parent_name: pn, parent_phone: ph,
        class_id: classA.id,
        behavior_points: 100 - i * 8,
        is_demo: true,
      })),
      ...DEMO_STUDENTS_B.map(([name, pn, ph], i) => ({
        name, parent_name: pn, parent_phone: ph,
        class_id: classB.id,
        behavior_points: 95 - i * 5,
        is_demo: true,
      })),
    ];

    const { error: se } = await sb.from("students").insert(rows);
    if (se) throw new Error(se.message);

    return { classes: classes.length as number, students: rows.length };
  });

export const wipeDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMaster(context as any);
    const sb = context.supabase as any;
    await sb.from("students").delete().eq("is_demo", true);
    await sb.from("classes").delete().eq("is_demo", true);
    return { ok: true };
  });
