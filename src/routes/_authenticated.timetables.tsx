import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/useRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Calendar, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/timetables")({
  component: TimetablesPage,
});

type Cell = { subject?: string; teacher?: string; room?: string };
type Grid = Record<string, Record<string, Cell>>; // day -> period -> cell

function TimetablesPage() {
  const { isAdmin } = useRoles();
  const qc = useQueryClient();
  const [classId, setClassId] = useState("");

  const classes = useQuery({
    queryKey: ["classes"],
    queryFn: async () => (await supabase.from("classes").select("*").order("name")).data ?? [],
  });

  const config = useQuery({
    queryKey: ["facility-config"],
    queryFn: async () => (await supabase.from("facility_config").select("*").eq("id", 1).maybeSingle()).data,
  });

  const tt = useQuery({
    queryKey: ["timetable", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase.from("timetables")
        .select("*").eq("scope", "class").eq("ref_id", classId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const days: string[] = config.data?.working_days ?? ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس"];
  const periods = config.data?.periods_per_day ?? 7;

  const [grid, setGrid] = useState<Grid>({});

  useEffect(() => {
    setGrid((tt.data?.payload as Grid) ?? {});
  }, [tt.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!classId) return;
      const className = classes.data?.find((c) => c.id === classId)?.name ?? "";
      const { error } = await supabase.from("timetables")
        .upsert({ scope: "class", ref_id: classId, title: `جدول ${className}`, payload: grid }, { onConflict: "scope,ref_id" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم حفظ الجدول"); qc.invalidateQueries({ queryKey: ["timetable", classId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const setCell = (day: string, p: number, field: keyof Cell, value: string) => {
    setGrid((g) => ({
      ...g,
      [day]: { ...(g[day] ?? {}), [p]: { ...(g[day]?.[p] ?? {}), [field]: value } },
    }));
  };

  const filled = useMemo(() => {
    let n = 0;
    days.forEach((d) => { for (let p = 1; p <= periods; p++) if (grid[d]?.[p]?.subject) n++; });
    return n;
  }, [grid, days, periods]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2"><Calendar className="h-7 w-7 text-primary" /> الجداول الدراسية</h2>
          <p className="text-muted-foreground text-sm mt-1">جدول أسبوعي لكل صف</p>
        </div>
        {isAdmin && classId && (
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2 gradient-primary text-primary-foreground">
            <Save className="h-4 w-4" /> حفظ
          </Button>
        )}
      </div>

      <div className="glass rounded-2xl p-4">
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="اختر الصف" /></SelectTrigger>
          <SelectContent>{classes.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {!classId && <div className="glass rounded-2xl p-10 text-center text-muted-foreground">اختر صفاً لعرض الجدول</div>}

      {classId && (
        <div className="glass rounded-2xl p-2 overflow-x-auto">
          <div className="text-xs text-muted-foreground p-2">{filled} حصة معبّأة من أصل {days.length * periods}</div>
          <table className="w-full text-xs sm:text-sm border-separate border-spacing-1 min-w-[600px]">
            <thead>
              <tr>
                <th className="p-2 text-muted-foreground font-normal">اليوم</th>
                {Array.from({ length: periods }, (_, i) => i + 1).map((p) => (
                  <th key={p} className="p-2 text-muted-foreground font-normal">حصة {p}</th>
                ))}
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
