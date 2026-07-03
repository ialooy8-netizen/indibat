import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar, Save, User, Users } from "lucide-react";
import { toast } from "sonner";
import { FeatureHelp } from "@/components/app/FeatureHelp";

export const Route = createFileRoute("/_authenticated/timetables")({
  component: TimetablesPage,
});

type Cell = { subject?: string; teacher?: string; room?: string };
type Grid = Record<string, Record<string, Cell>>;

const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس"];

function todayNameAr(): string {
  const idx = new Date().getDay(); // 0=Sun
  return ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][idx];
}

function TimetablesPage() {
  const { user } = useAuth();
  const { isAdmin, isTeacher } = useRoles();
  const [tab, setTab] = useState<"mine" | "class" | "all">(isTeacher && !isAdmin ? "mine" : "class");

  const config = useQuery({
    queryKey: ["facility-config"],
    queryFn: async () => (await supabase.from("facility_config").select("*").eq("id", 1).maybeSingle()).data,
  });
  const days: string[] = config.data?.working_days ?? DAY_NAMES;
  const periods = config.data?.periods_per_day ?? 7;

  const profile = useQuery({
    queryKey: ["my-name", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle()).data,
  });

  const allTimetables = useQuery({
    queryKey: ["timetables-all"],
    queryFn: async () => {
      const [tts, cls] = await Promise.all([
        supabase.from("timetables").select("*").eq("scope", "class"),
        supabase.from("classes").select("id, name"),
      ]);
      if (tts.error) throw tts.error;
      const cmap = new Map((cls.data ?? []).map((c) => [c.id, c.name] as const));
      return (tts.data ?? []).map((t) => ({ ...t, class_name: cmap.get(t.ref_id) ?? "—" }));
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold flex items-center gap-2">
          <Calendar className="h-7 w-7 text-primary" /> الجداول الدراسية
          <FeatureHelp title="الجداول الدراسية">
            <p>ثلاث عروض للجدول: جدولي الشخصي (المعلم يرى فقط حصصه)، جدول الصف اليومي، والجدول العام لجميع المعلمين.</p>
            <p>الإدارة يمكنها تحرير جدول أي صف من تبويب "جدول الصف".</p>
          </FeatureHelp>
        </h2>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          {isTeacher && <TabsTrigger value="mine" className="gap-1"><User className="h-3 w-3" /> جدولي</TabsTrigger>}
          <TabsTrigger value="class" className="gap-1"><Calendar className="h-3 w-3" /> جدول الصف</TabsTrigger>
          <TabsTrigger value="all" className="gap-1"><Users className="h-3 w-3" /> الجدول العام</TabsTrigger>
        </TabsList>

        {isTeacher && (
          <TabsContent value="mine" className="mt-4">
            <MyScheduleView timetables={allTimetables.data ?? []} days={days} periods={periods} teacherName={profile.data?.full_name ?? ""} />
          </TabsContent>
        )}

        <TabsContent value="class" className="mt-4">
          <ClassEditor days={days} periods={periods} isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          <AllTeachersView timetables={allTimetables.data ?? []} days={days} periods={periods} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* --- My schedule (teacher) --- */

type StoredTt = { class_name: string; payload: unknown };
function MyScheduleView({ timetables, days, periods, teacherName }: { timetables: StoredTt[]; days: string[]; periods: number; teacherName: string }) {
  const today = todayNameAr();
  const cells = useMemo(() => {
    // day -> period -> [{class, subject}]
    const map = new Map<string, Map<number, { class_name: string; subject: string }[]>>();
    for (const tt of timetables) {
      const payload = (tt.payload ?? {}) as Grid;
      for (const d of Object.keys(payload)) {
        for (const p of Object.keys(payload[d] ?? {})) {
          const c = payload[d][p];
          if (!c?.teacher || !teacherName) continue;
          if (!c.teacher.trim().includes(teacherName.trim()) && !teacherName.trim().includes(c.teacher.trim())) continue;
          if (!map.has(d)) map.set(d, new Map());
          const inner = map.get(d)!;
          const pn = Number(p);
          if (!inner.has(pn)) inner.set(pn, []);
          inner.get(pn)!.push({ class_name: tt.class_name, subject: c.subject ?? "" });
        }
      }
    }
    return map;
  }, [timetables, teacherName]);

  if (!teacherName) return <div className="glass rounded-2xl p-10 text-center text-muted-foreground">لا يوجد اسم في ملفك الشخصي</div>;

  return (
    <div className="glass rounded-2xl p-3 overflow-x-auto">
      <p className="text-xs text-muted-foreground p-2">يعتمد على تطابق اسم المعلم في خانات الجدول. اليوم: <span className="font-bold text-primary">{today}</span></p>
      <table className="w-full text-xs sm:text-sm border-separate border-spacing-1 min-w-[600px]">
        <thead>
          <tr>
            <th className="p-2 text-muted-foreground font-normal text-start">اليوم</th>
            {Array.from({ length: periods }, (_, i) => i + 1).map((p) => <th key={p} className="p-2 text-muted-foreground font-normal">حصة {p}</th>)}
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d} className={d === today ? "bg-primary/5" : ""}>
              <td className="p-2 font-semibold whitespace-nowrap">{d}{d === today && " ⭐"}</td>
              {Array.from({ length: periods }, (_, i) => i + 1).map((p) => {
                const items = cells.get(d)?.get(p) ?? [];
                return (
                  <td key={p} className="p-1 align-top">
                    {items.length === 0 ? (
                      <div className="min-h-[44px] rounded p-2 bg-white/3 text-muted-foreground text-[10px] text-center">—</div>
                    ) : (
                      <div className="rounded p-2 bg-primary/15 border border-primary/30 space-y-0.5">
                        {items.map((it, i) => (
                          <div key={i}>
                            <div className="font-medium text-xs">{it.subject || "—"}</div>
                            <div className="text-[10px] text-muted-foreground">{it.class_name}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* --- Class editor (admin) / viewer (others) --- */

function ClassEditor({ days, periods, isAdmin }: { days: string[]; periods: number; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [classId, setClassId] = useState("");

  const classes = useQuery({
    queryKey: ["classes"],
    queryFn: async () => (await supabase.from("classes").select("*").order("name")).data ?? [],
  });

  const tt = useQuery({
    queryKey: ["timetable", classId],
    enabled: !!classId,
    queryFn: async () => (await supabase.from("timetables").select("*").eq("scope", "class").eq("ref_id", classId).maybeSingle()).data,
  });

  const [grid, setGrid] = useState<Grid>({});
  useEffect(() => { setGrid((tt.data?.payload as Grid) ?? {}); }, [tt.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!classId) return;
      const className = classes.data?.find((c) => c.id === classId)?.name ?? "";
      const { error } = await supabase.from("timetables")
        .upsert({ scope: "class", ref_id: classId, title: `جدول ${className}`, payload: grid }, { onConflict: "scope,ref_id" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم حفظ الجدول"); qc.invalidateQueries({ queryKey: ["timetable", classId] }); qc.invalidateQueries({ queryKey: ["timetables-all"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const setCell = (day: string, p: number, field: keyof Cell, value: string) => {
    setGrid((g) => ({ ...g, [day]: { ...(g[day] ?? {}), [p]: { ...(g[day]?.[p] ?? {}), [field]: value } } }));
  };

  const filled = useMemo(() => {
    let n = 0;
    days.forEach((d) => { for (let p = 1; p <= periods; p++) if (grid[d]?.[p]?.subject) n++; });
    return n;
  }, [grid, days, periods]);

  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="اختر الصف" /></SelectTrigger>
          <SelectContent>{classes.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        {isAdmin && classId && (
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2 gradient-primary text-primary-foreground ms-auto">
            <Save className="h-4 w-4" /> حفظ
          </Button>
        )}
      </div>

      {!classId && <div className="glass rounded-2xl p-10 text-center text-muted-foreground">اختر صفاً لعرض الجدول</div>}

      {classId && (
        <div className="glass rounded-2xl p-2 overflow-x-auto">
          <div className="text-xs text-muted-foreground p-2">{filled} حصة معبّأة من أصل {days.length * periods}</div>
          <table className="w-full text-xs sm:text-sm border-separate border-spacing-1 min-w-[600px]">
            <thead>
              <tr>
                <th className="p-2 text-muted-foreground font-normal">اليوم</th>
                {Array.from({ length: periods }, (_, i) => i + 1).map((p) => <th key={p} className="p-2 text-muted-foreground font-normal">حصة {p}</th>)}
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day}>
                  <td className="p-2 font-semibold whitespace-nowrap">{day}</td>
                  {Array.from({ length: periods }, (_, i) => i + 1).map((p) => {
                    const cell = grid[day]?.[p] ?? {};
                    return (
                      <td key={p} className="p-1 align-top">
                        {isAdmin ? (
                          <div className="space-y-1">
                            <Input value={cell.subject ?? ""} placeholder="مادة" onChange={(e) => setCell(day, p, "subject", e.target.value)} className="h-8 text-xs" />
                            <Input value={cell.teacher ?? ""} placeholder="معلم" onChange={(e) => setCell(day, p, "teacher", e.target.value)} className="h-7 text-xs opacity-80" />
                          </div>
                        ) : (
                          <div className="bg-white/5 rounded p-2 min-h-[44px]">
                            <div className="font-medium">{cell.subject || "—"}</div>
                            {cell.teacher && <div className="text-xs text-muted-foreground">{cell.teacher}</div>}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* --- All teachers view --- */

function AllTeachersView({ timetables, days, periods }: { timetables: StoredTt[]; days: string[]; periods: number }) {
  const [day, setDay] = useState<string>(todayNameAr());
  const activeDay = days.includes(day) ? day : days[0];

  // teacher -> period -> [{class, subject}]
  const map = useMemo(() => {
    const t = new Map<string, Map<number, { class_name: string; subject: string }[]>>();
    for (const tt of timetables) {
      const payload = (tt.payload ?? {}) as Grid;
      const dayCells = payload[activeDay] ?? {};
      for (const p of Object.keys(dayCells)) {
        const c = dayCells[p];
        const name = (c?.teacher ?? "").trim();
        if (!name) continue;
        if (!t.has(name)) t.set(name, new Map());
        const inner = t.get(name)!;
        const pn = Number(p);
        if (!inner.has(pn)) inner.set(pn, []);
        inner.get(pn)!.push({ class_name: tt.class_name, subject: c?.subject ?? "" });
      }
    }
    return t;
  }, [timetables, activeDay]);

  const teachers = Array.from(map.keys()).sort((a, b) => a.localeCompare(b, "ar"));

  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <span className="text-sm">اليوم:</span>
        <Select value={activeDay} onValueChange={setDay}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{days.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {teachers.length === 0 && <div className="glass rounded-2xl p-10 text-center text-muted-foreground">لا توجد بيانات لهذا اليوم</div>}

      {teachers.length > 0 && (
        <div className="glass rounded-2xl p-2 overflow-x-auto">
          <table className="w-full text-xs sm:text-sm border-separate border-spacing-1 min-w-[700px]">
            <thead>
              <tr>
                <th className="p-2 text-muted-foreground font-normal text-start">المعلم</th>
                {Array.from({ length: periods }, (_, i) => i + 1).map((p) => <th key={p} className="p-2 text-muted-foreground font-normal">حصة {p}</th>)}
              </tr>
            </thead>
            <tbody>
              {teachers.map((tname) => (
                <tr key={tname}>
                  <td className="p-2 font-semibold whitespace-nowrap">{tname}</td>
                  {Array.from({ length: periods }, (_, i) => i + 1).map((p) => {
                    const items = map.get(tname)?.get(p) ?? [];
                    return (
                      <td key={p} className="p-1 align-top">
                        {items.length === 0 ? (
                          <div className="min-h-[40px] rounded p-2 bg-white/3 text-muted-foreground text-[10px] text-center">—</div>
                        ) : (
                          <div className="rounded p-2 bg-accent/10 border border-accent/20 space-y-0.5">
                            {items.map((it, i) => (
                              <div key={i}>
                                <div className="font-medium text-xs">{it.subject || "—"}</div>
                                <div className="text-[10px] text-muted-foreground">{it.class_name}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
