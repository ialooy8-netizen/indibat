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
  ["أحمد بن سالم", "والد أحمد", "97333000001"],
  ["خالد العتيبي", "أم خالد", "97333000002"],
  ["عبدالله الزهراني", "والد عبدالله", "97333000003"],
  ["محمد القحطاني", "أم محمد", "97333000004"],
  ["سعد الدوسري", "والد سعد", "97333000005"],
  ["فهد الشمري", "أم فهد", "97333000006"],
  ["يوسف العنزي", "والد يوسف", "97333000007"],
];

const DEMO_STUDENTS_B: Array<[string, string, string]> = [
  ["نورة الحارثي", "والد نورة", "97333000008"],
  ["سارة المطيري", "والد سارة", "97333000009"],
  ["مريم البلوي", "والد مريم", "97333000010"],
  ["هند السبيعي", "والد هند", "97333000011"],
  ["لطيفة الغامدي", "والد لطيفة", "97333000012"],
];

const DEMO_TT_A = {
  "الأحد": {
    "1": { subject: "رياضيات", teacher: "أ. أحمد المعلم" },
    "2": { subject: "لغة عربية", teacher: "أ. فاطمة الخبيرة" },
    "3": { subject: "علوم", teacher: "أ. ليلى" },
    "4": { subject: "إنجليزي", teacher: "أ. سارة" },
    "5": { subject: "تربية إسلامية", teacher: "أ. عبدالرحمن" },
    "6": { subject: "رياضة", teacher: "أ. خالد" },
    "7": { subject: "حاسوب", teacher: "أ. منى" },
  },
  "الإثنين": {
    "1": { subject: "لغة عربية", teacher: "أ. فاطمة الخبيرة" },
    "2": { subject: "رياضيات", teacher: "أ. أحمد المعلم" },
    "3": { subject: "علوم", teacher: "أ. ليلى" },
    "4": { subject: "فنون", teacher: "أ. رنا" },
    "5": { subject: "اجتماعيات", teacher: "أ. حسن" },
    "6": { subject: "إنجليزي", teacher: "أ. سارة" },
    "7": { subject: "تربية إسلامية", teacher: "أ. عبدالرحمن" },
  },
};

function daysBack(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export const seedDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMaster(context as any);
    const sb = context.supabase as any;

    // Clean previous demo
    const { data: oldClasses } = await sb.from("classes").select("id").eq("is_demo", true);
    const oldClassIds = (oldClasses ?? []).map((c: any) => c.id);
    if (oldClassIds.length) {
      await sb.from("attendance").delete().in("class_id", oldClassIds);
      await sb.from("timetables").delete().eq("scope", "class").in("ref_id", oldClassIds);
    }
    await sb.from("students").delete().eq("is_demo", true);
    await sb.from("classes").delete().eq("is_demo", true);

    // Classes
    const { data: classes, error: ce } = await sb.from("classes")
      .insert(DEMO_CLASSES.map((c) => ({ ...c, is_demo: true })))
      .select("id, name");
    if (ce) throw new Error(ce.message);
    const classA = classes.find((c: any) => c.name.includes("5/أ"));
    const classB = classes.find((c: any) => c.name.includes("6/ب"));

    // Students
    const studentRows: any[] = [
      ...DEMO_STUDENTS_A.map(([name, pn, ph], i) => ({
        name, parent_name: pn, parent_phone: ph, class_id: classA.id,
        behavior_points: 100 - i * 8, is_demo: true,
      })),
      ...DEMO_STUDENTS_B.map(([name, pn, ph], i) => ({
        name, parent_name: pn, parent_phone: ph, class_id: classB.id,
        behavior_points: 95 - i * 5, is_demo: true,
      })),
    ];
    const { data: students, error: se } = await sb.from("students").insert(studentRows).select("id, name, behavior_points, class_id");
    if (se) throw new Error(se.message);

    // Attendance for last 14 days (teacher_id = current master user)
    const teacherId = context.userId;
    const attRows: any[] = [];
    for (let d = 14; d >= 1; d--) {
      const date = daysBack(d);
      for (const s of students) {
        // Weighted: lower behavior => more absences
        const bad = (100 - (s.behavior_points ?? 100)) / 100; // 0..1
        const roll = Math.random();
        let status: "present" | "absent" | "late" = "present";
        if (roll < bad * 0.25) status = "absent";
        else if (roll < bad * 0.4 + 0.05) status = "late";
        attRows.push({
          student_id: s.id, class_id: s.class_id, date,
          period: 1, status, teacher_id: teacherId,
        });
      }
    }
    if (attRows.length) await sb.from("attendance").insert(attRows);

    // Behavior incidents for a couple of at-risk students
    const atRisk = students.filter((s: any) => (s.behavior_points ?? 100) < 70).slice(0, 4);
    const incidents = atRisk.flatMap((s: any) => [
      { student_id: s.id, teacher_id: teacherId, type: "infraction", points: 5, note: "إزعاج في الفصل", created_at: new Date(Date.now() - 3 * 86400000).toISOString() },
      { student_id: s.id, teacher_id: teacherId, type: "infraction", points: 3, note: "تأخر متكرر", created_at: new Date(Date.now() - 8 * 86400000).toISOString() },
    ]);
    if (incidents.length) await sb.from("behavior_incidents").insert(incidents);

    // Demo timetable for class A
    await sb.from("timetables").upsert({
      scope: "class", ref_id: classA.id, title: `جدول ${classA.name}`, payload: DEMO_TT_A,
    }, { onConflict: "scope,ref_id" });

    // Demo circular (pinned)
    await sb.from("circulars").insert({
      posted_by: teacherId,
      title: "📌 [تجريبي] الاجتماع الأسبوعي يوم الأحد الساعة 8 صباحاً",
      body: "الحضور إلزامي لجميع الكادر التعليمي في قاعة الاجتماعات.",
      pinned: true,
      audience: "all",
    });

    // Demo print request
    await sb.from("print_requests").insert([
      { employee_id: teacherId, title: "[تجريبي] أوراق نشاط رياضيات — الوحدة 3", copies: 25, status: "pending" },
      { employee_id: teacherId, title: "[تجريبي] اختبار قصير — سري", copies: 30, is_confidential: true, status: "pending_principal" },
    ]);

    // Demo leave request
    await sb.from("leave_requests").insert({
      employee_id: teacherId, leave_type: "partial_leave",
      reason: "[تجريبي] موعد طبي", start_date: daysBack(0), end_date: daysBack(0),
      leave_from: "10:00", will_return: true, expected_return: "12:30", status: "pending",
    });

    // Demo notification to the master
    await sb.from("notifications").insert({
      user_id: teacherId,
      kind: "demo",
      title: "أهلاً بك في وضع التجربة 🎉",
      body: "تم إنشاء بيانات تجريبية شاملة. جرّب صفحة المتنبئ والحضور والجداول لرؤية كل الميزات.",
      link: "/",
    });

    return {
      classes: classes.length as number,
      students: students.length as number,
      attendance: attRows.length,
      incidents: incidents.length,
    };
  });

export const wipeDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMaster(context as any);
    const sb = context.supabase as any;
    const { data: oldClasses } = await sb.from("classes").select("id").eq("is_demo", true);
    const oldClassIds = (oldClasses ?? []).map((c: any) => c.id);
    if (oldClassIds.length) {
      await sb.from("attendance").delete().in("class_id", oldClassIds);
      await sb.from("timetables").delete().eq("scope", "class").in("ref_id", oldClassIds);
    }
    await sb.from("students").delete().eq("is_demo", true);
    await sb.from("classes").delete().eq("is_demo", true);
    // Best-effort cleanup of demo notices/prints/leaves by title marker
    await sb.from("circulars").delete().like("title", "%[تجريبي]%");
    await sb.from("print_requests").delete().like("title", "%[تجريبي]%");
    await sb.from("leave_requests").delete().like("reason", "%[تجريبي]%");
    await sb.from("notifications").delete().eq("kind", "demo");
    return { ok: true };
  });
