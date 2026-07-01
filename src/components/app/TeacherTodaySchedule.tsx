import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Calendar as CalendarIcon, Clock, MapPin, GraduationCap, Timer } from "lucide-react";
import { FeatureHelp } from "./FeatureHelp";

// Bahrain school week: Sun-Thu
const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

type Cell = { subject?: string; teacher?: string; room?: string };
type Grid = Record<string, Record<string, Cell>>;

type TT = {
  id: string;
  ref_id: string | null;
  scope: string;
  title: string | null;
  payload: Grid | null;
};

// Default bell schedule (can later be overridden by facility_config)
const DEFAULT_PERIODS: { p: number; start: string; end: string }[] = [
  { p: 1, start: "07:30", end: "08:15" },
  { p: 2, start: "08:15", end: "09:00" },
  { p: 3, start: "09:00", end: "09:45" },
  { p: 4, start: "10:15", end: "11:00" },
  { p: 5, start: "11:00", end: "11:45" },
  { p: 6, start: "11:45", end: "12:30" },
  { p: 7, start: "12:30", end: "13:15" },
];

function minutesOfDay(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function TeacherTodaySchedule() {
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const myName = useQuery({
    queryKey: ["me-name", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle()).data?.full_name ?? null,
  });

  const tables = useQuery({
    queryKey: ["all-timetables"],
    queryFn: async () => {
      const { data, error } = await supabase.from("timetables").select("id, ref_id, scope, title, payload");
      if (error) throw error;
      return (data ?? []) as TT[];
    },
  });

  const classes = useQuery({
    queryKey: ["classes-min"],
    queryFn: async () => (await supabase.from("classes").select("id, name")).data ?? [],
  });

  const today = DAY_NAMES[now.getDay()];
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const items = useMemo(() => {
    if (!tables.data || !myName.data) return [];
    const classNameOf = new Map((classes.data ?? []).map((c) => [c.id, c.name]));
    const list: { period: number; subject: string; className: string; room: string; start: string; end: string }[] = [];
    for (const t of tables.data) {
      if (t.scope !== "class" || !t.payload) continue;
      const dayCells = t.payload[today];
      if (!dayCells) continue;
      for (const [pStr, cell] of Object.entries(dayCells)) {
        const p = Number(pStr);
        if (!cell.teacher || cell.teacher.trim() !== myName.data.trim()) continue;
        const bell = DEFAULT_PERIODS.find((b) => b.p === p);
        list.push({
          period: p,
          subject: cell.subject ?? "—",
          className: classNameOf.get(t.ref_id ?? "") ?? t.title ?? "صف",
          room: cell.room ?? "",
          start: bell?.start ?? "",
          end: bell?.end ?? "",
        });
      }
    }
    return list.sort((a, b) => a.period - b.period);
  }, [tables.data, myName.data, classes.data, today]);

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-primary" /> جدول اليوم — {today}
        </h3>
        <FeatureHelp title="جدول اليوم">
          <p>يعرض حصصك المجدولة لهذا اليوم فقط، مع تذكير عندما تقترب الحصة القادمة (خلال 15 دقيقة).</p>
          <p>يعتمد على الجدول الذي أنشأه المسؤول ويطابق الحصص باسمك الكامل الوارد في ملفك الشخصي.</p>
        </FeatureHelp>
      </div>

      {tables.isPending && <p className="text-sm text-muted-foreground text-center py-4">جاري التحميل...</p>}
      {!tables.isPending && items.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          لا توجد حصص مسجلة لك اليوم. تأكد من أن اسمك في ملفك الشخصي مطابق تماماً للاسم المكتوب في خانة "المعلم" داخل الجدول.
        </p>
      )}
      <div className="space-y-2">
        {items.map((it) => {
          const startMin = it.start ? minutesOfDay(it.start) : null;
          const endMin = it.end ? minutesOfDay(it.end) : null;
          const inClass = startMin !== null && endMin !== null && nowMin >= startMin && nowMin < endMin;
          const soon = startMin !== null && startMin - nowMin > 0 && startMin - nowMin <= 15;
          const passed = endMin !== null && nowMin >= endMin;
          const mins = startMin !== null ? startMin - nowMin : null;
          return (
            <div key={it.period}
              className={`rounded-xl border px-3 py-2.5 flex items-center gap-3 ${
                inClass ? "border-success/60 bg-success/10"
                : soon ? "border-warning/60 bg-warning/10 animate-pulse"
                : passed ? "border-border/30 opacity-60"
                : "border-border/40"
              }`}>
              <div className="text-xs font-bold w-10 text-center tabular-nums">حصة {it.period}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold flex items-center gap-2 flex-wrap">
                  {it.subject}
                  <span className="text-xs inline-flex items-center gap-1 text-muted-foreground">
                    <GraduationCap className="h-3 w-3" /> {it.className}
                  </span>
                  {it.room && (
                    <span className="text-xs inline-flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {it.room}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {it.start} – {it.end}
                  {inClass && <span className="text-success font-bold mr-2">— جارية الآن</span>}
                  {soon && mins !== null && (
                    <span className="text-warning font-bold mr-2 inline-flex items-center gap-1">
                      <Timer className="h-3 w-3" /> تبدأ بعد {mins} دقيقة
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
