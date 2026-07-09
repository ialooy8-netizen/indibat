import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Phone, MessageCircle, GraduationCap } from "lucide-react";
import { FeatureHelp } from "./FeatureHelp";
import { SmsButton } from "./SmsButton";

type ClassRow = { id: string; name: string };
type CTRow = { class_id: string; teacher_id: string };
type Profile = { id: string; full_name: string | null; phone: string | null };

export function MissingAttendanceCard() {
  const today = new Date().toISOString().slice(0, 10);

  const q = useQuery({
    queryKey: ["missing-attendance", today],
    refetchInterval: 60_000,
    queryFn: async () => {
      const [{ data: classes }, { data: att }, { data: ct }] = await Promise.all([
        supabase.from("classes").select("id, name").order("name"),
        supabase.from("attendance").select("students!inner(class_id)").eq("date", today),
        supabase.from("class_teachers").select("class_id, teacher_id"),
      ]);
      const submittedClassIds = new Set<string>(
        ((att ?? []) as Array<{ students: { class_id: string | null } | null }>)
          .map((r) => r.students?.class_id).filter((v): v is string => !!v),
      );
      const missing = ((classes ?? []) as ClassRow[]).filter((c) => !submittedClassIds.has(c.id));

      const teacherIds = Array.from(new Set(((ct ?? []) as CTRow[]).map((r) => r.teacher_id)));
      const profiles = teacherIds.length
        ? (await supabase.from("profiles").select("id, full_name, phone").in("id", teacherIds)).data ?? []
        : [];
      const profMap = new Map<string, Profile>(((profiles as Profile[]) ?? []).map((p) => [p.id, p]));

      const teachersByClass = new Map<string, Profile[]>();
      for (const row of (ct ?? []) as CTRow[]) {
        const arr = teachersByClass.get(row.class_id) ?? [];
        const p = profMap.get(row.teacher_id);
        if (p) arr.push(p);
        teachersByClass.set(row.class_id, arr);
      }
      return missing.map((c) => ({ ...c, teachers: teachersByClass.get(c.id) ?? [] }));
    },
  });

  const total = useMemo(() => q.data?.length ?? 0, [q.data]);

  function waLink(phone: string, className: string) {
    const clean = phone.replace(/[^\d]/g, "");
    const msg = encodeURIComponent(`السلام عليكم. تذكير ودّي: لم يتم تسجيل حضور صف "${className}" اليوم. نرجو تسجيله في تطبيق EduPulse في أقرب وقت. شكراً لك.`);
    return `https://wa.me/${clean}?text=${msg}`;
  }

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" /> صفوف لم تسجّل الحضور اليوم
          <span className="text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning tabular-nums">{total}</span>
        </h3>
        <FeatureHelp title="متابعة الحضور اليومي">
          <p>يعرض هذا القسم الصفوف التي لم يُسجّل فيها الحضور اليوم بعد.</p>
          <p>يمكنك إرسال تذكير مباشر عبر واتساب للمعلم المكلّف بالصف بضغطة واحدة، وستُدرج تسمية الصف تلقائياً في الرسالة.</p>
        </FeatureHelp>
      </div>

      {q.isPending && <p className="text-sm text-muted-foreground text-center py-3">جاري التحميل...</p>}
      {!q.isPending && total === 0 && (
        <p className="text-sm text-success text-center py-3">ممتاز — كل الصفوف سجّلت الحضور اليوم.</p>
      )}

      <div className="space-y-2">
        {q.data?.map((c) => (
          <div key={c.id} className="rounded-xl border border-warning/30 bg-warning/5 px-3 py-2.5">
            <div className="flex items-center gap-2 font-semibold">
              <GraduationCap className="h-4 w-4 text-warning" /> {c.name}
            </div>
            <div className="mt-1 space-y-1">
              {c.teachers.length === 0 && (
                <div className="text-xs text-muted-foreground">لا يوجد معلم مربوط بهذا الصف. أضف رابطاً من الإعدادات.</div>
              )}
              {c.teachers.map((t) => (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t.full_name ?? "بدون اسم"}</span>
                    {t.phone && <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {t.phone}</span>}
                  </div>
                  {t.phone && (
                    <div className="flex items-center gap-1">
                      <a href={waLink(t.phone, c.name)} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-success text-success-foreground hover:opacity-90">
                        <MessageCircle className="h-3.5 w-3.5" /> واتساب
                      </a>
                      <SmsButton phone={t.phone} message={`تذكير: لم يُسجَّل حضور صف "${c.name}" اليوم. الرجاء تسجيله في EduPulse.`} label="SMS" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
