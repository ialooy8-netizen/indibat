import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Star, AlertTriangle, ClipboardCheck, CheckCheck, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/attendance")({
  component: AttendancePage,
});

function AttendancePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [classId, setClassId] = useState<string>("");
  const today = new Date().toISOString().slice(0, 10);
  const [period, setPeriod] = useState<number>(1);
  const [modal, setModal] = useState<{ studentId: string; name: string } | null>(null);

  const classes = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const students = useQuery({
    queryKey: ["attendance-students", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase.from("students")
        .select("id, name, behavior_points, parent_phone, parent_name")
        .eq("class_id", classId).order("name");
      if (error) throw error;
      return data;
    },
  });

  const att = useQuery({
    queryKey: ["attendance-day", classId, today, period],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance")
        .select("student_id, status").eq("date", today).eq("period", period);
      if (error) throw error;
      return new Map(data.map((r) => [r.student_id, r.status]));
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ studentId, status }: { studentId: string; status: "present" | "absent" }) => {
      const { error } = await supabase.from("attendance").upsert({
        student_id: studentId, date: today, period, status, recorded_by: user?.id,
      }, { onConflict: "student_id,date,period" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance-day"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const markAllPresent = useMutation({
    mutationFn: async () => {
      if (!students.data) return;
      const rows = students.data.map((s) => ({
        student_id: s.id, date: today, period, status: "present", recorded_by: user?.id,
      }));
      const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "student_id,date,period" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم تسجيل الجميع حاضرين"); qc.invalidateQueries({ queryKey: ["attendance-day"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const absentList = useMemo(() => {
    if (!students.data || !att.data) return [];
    return students.data.filter((s) => att.data.get(s.id) === "absent" && s.parent_phone);
  }, [students.data, att.data]);

  function notifyAllAbsent() {
    if (absentList.length === 0) return toast.info("لا يوجد غياب بأرقام جوال مسجلة");
    const className = classes.data?.find((c) => c.id === classId)?.name ?? "";
    absentList.forEach((s, idx) => {
      const msg = `السلام عليكم${s.parent_name ? " " + s.parent_name : ""}، نود إعلامكم بغياب الطالب ${s.name} من صف ${className} اليوم. للتواصل مع المدرسة عند الحاجة.`;
      const url = `https://wa.me/${s.parent_phone!.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
      setTimeout(() => window.open(url, "_blank"), idx * 250);
    });
  }

  const stats = useMemo(() => {
    if (!students.data || !att.data) return { present: 0, absent: 0, unset: 0 };
    let present = 0, absent = 0;
    students.data.forEach((s) => {
      const st = att.data!.get(s.id);
      if (st === "present") present++;
      else if (st === "absent") absent++;
    });
    return { present, absent, unset: (students.data.length ?? 0) - present - absent };
  }, [students.data, att.data]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold flex items-center gap-2"><ClipboardCheck className="h-7 w-7 text-primary" /> الحضور والتقييم</h2>
        <p className="text-muted-foreground text-sm mt-1">{new Date().toLocaleDateString("ar", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      </div>

      <div className="glass rounded-2xl p-4 flex flex-wrap gap-3">
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger className="w-56"><SelectValue placeholder="اختر الصف" /></SelectTrigger>
          <SelectContent>{classes.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(period)} onValueChange={(v) => setPeriod(Number(v))}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{[1,2,3,4,5,6,7,8].map((p) => <SelectItem key={p} value={String(p)}>الحصة {p}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {!classId && <div className="glass rounded-2xl p-10 text-center text-muted-foreground">اختر الصف لعرض قائمة الطلاب</div>}

      {classId && students.data && students.data.length > 0 && (
        <>
          <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
            <div className="flex gap-3 text-sm flex-1 min-w-[200px]">
              <span className="text-success">✓ {stats.present}</span>
              <span className="text-destructive">✗ {stats.absent}</span>
              <span className="text-muted-foreground">— {stats.unset}</span>
            </div>
            <Button size="sm" variant="outline" onClick={() => markAllPresent.mutate()} disabled={markAllPresent.isPending} className="gap-1">
              <CheckCheck className="h-4 w-4" /> الكل حاضر
            </Button>
            {stats.absent > 0 && (
              <Button size="sm" onClick={notifyAllAbsent} className="gap-1 bg-accent text-accent-foreground">
                <MessageSquare className="h-4 w-4" /> إشعار أولياء الغائبين ({absentList.length})
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {students.data.map((s) => {
              const status = att.data?.get(s.id);
              return (
                <div key={s.id} className="glass rounded-xl p-3 flex items-center gap-3">
                  <span className="flex-1 font-medium truncate">{s.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${s.behavior_points >= 80 ? "bg-success/20 text-success" : s.behavior_points >= 60 ? "bg-warning/20 text-warning" : "bg-destructive/20 text-destructive"}`}>{s.behavior_points}</span>
                  <Button size="sm" variant="outline" onClick={() => setModal({ studentId: s.id, name: s.name })} className="gap-1 hidden sm:flex"><Star className="h-3.5 w-3.5" /> تقييم</Button>
                  <Button size="icon" variant="outline" onClick={() => setModal({ studentId: s.id, name: s.name })} className="sm:hidden h-9 w-9"><Star className="h-4 w-4" /></Button>
                  <Button size="sm" onClick={() => setStatus.mutate({ studentId: s.id, status: "present" })}
                    className={status === "present" ? "bg-success text-success-foreground" : "bg-transparent border border-border"}><Check className="h-4 w-4" /></Button>
                  <Button size="sm" onClick={() => setStatus.mutate({ studentId: s.id, status: "absent" })}
                    className={status === "absent" ? "bg-destructive text-destructive-foreground" : "bg-transparent border border-border"}><X className="h-4 w-4" /></Button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {classId && students.data?.length === 0 && (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">لا يوجد طلاب في هذا الصف</div>
      )}

      <BehaviorModal data={modal} onClose={() => setModal(null)} onSaved={() => { qc.invalidateQueries({ queryKey: ["attendance-students"] }); setModal(null); }} />
    </div>
  );
}

function BehaviorModal({ data, onClose, onSaved }: { data: { studentId: string; name: string } | null; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [type, setType] = useState<"reward" | "infraction">("reward");
  const [points, setPoints] = useState<number>(5);
  const [severity, setSeverity] = useState<"mild" | "moderate" | "serious">("mild");
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      if (!data) return;
      const { error } = await supabase.from("behavior_incidents").insert({
        student_id: data.studentId, type, points, severity: type === "infraction" ? severity : null,
        note: note || null, teacher_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم تسجيل التقييم"); setNote(""); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={!!data} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{data?.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setType("reward")} className={type === "reward" ? "bg-success text-success-foreground" : "border border-border bg-transparent"}><Star className="h-4 w-4 ml-1" /> مكافأة</Button>
            <Button onClick={() => setType("infraction")} className={type === "infraction" ? "bg-destructive text-destructive-foreground" : "border border-border bg-transparent"}><AlertTriangle className="h-4 w-4 ml-1" /> مخالفة</Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(type === "reward" ? [5,10,20] : [3,8,15]).map((p) => (
              <Button key={p} variant={points === p ? "default" : "outline"} onClick={() => setPoints(p)}>{type === "reward" ? "+" : "-"}{p}</Button>
            ))}
          </div>
          {type === "infraction" && (
            <Select value={severity} onValueChange={(v) => setSeverity(v as "mild" | "moderate" | "serious")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mild">بسيطة</SelectItem>
                <SelectItem value="moderate">متوسطة</SelectItem>
                <SelectItem value="serious">جسيمة</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Textarea placeholder="ملاحظة (اختياري)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full gradient-primary text-primary-foreground">حفظ التقييم</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
