import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/useRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Settings as SettingsIcon, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { isMaster, loading } = useRoles();

  if (loading) return <div className="text-muted-foreground p-6">جاري التحميل...</div>;
  if (!isMaster) return <Navigate to="/" />;

  return (
    <div className="space-y-8 max-w-3xl">
      <h2 className="text-3xl font-bold flex items-center gap-2">
        <SettingsIcon className="h-7 w-7 text-primary" /> الإعدادات
      </h2>
      <FacilityConfigSection />
      <ClassTeachersSection />
    </div>
  );
}

function FacilityConfigSection() {
  const qc = useQueryClient();
  const cfg = useQuery({
    queryKey: ["facility-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("facility_config").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [periods, setPeriods] = useState(7);
  const [workingDays, setWorkingDays] = useState("");
  const [resources, setResources] = useState("");

  useEffect(() => {
    if (cfg.data) {
      setPeriods(cfg.data.periods_per_day);
      setWorkingDays(cfg.data.working_days.join("، "));
      setResources(cfg.data.resources.join("، "));
    }
  }, [cfg.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("facility_config").update({
        periods_per_day: periods,
        working_days: workingDays.split(/[,،]/).map((s) => s.trim()).filter(Boolean),
        resources: resources.split(/[,،]/).map((s) => s.trim()).filter(Boolean),
      }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["facility-config"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="glass rounded-2xl p-6 space-y-4">
      <h3 className="text-xl font-bold">إعدادات اليوم الدراسي</h3>
      <div><Label>عدد الحصص في اليوم</Label><Input type="number" min={1} max={12} value={periods} onChange={(e) => setPeriods(Number(e.target.value))} /></div>
      <div><Label>أيام العمل (مفصولة بفاصلة)</Label><Input value={workingDays} onChange={(e) => setWorkingDays(e.target.value)} /></div>
      <div><Label>المرافق المتاحة (مفصولة بفاصلة)</Label><Input value={resources} onChange={(e) => setResources(e.target.value)} /></div>
      <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full gradient-primary text-primary-foreground">حفظ</Button>
    </section>
  );
}

function ClassTeachersSection() {
  const qc = useQueryClient();
  const [classId, setClassId] = useState("");
  const [teacherId, setTeacherId] = useState("");

  const classes = useQuery({
    queryKey: ["classes-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Only show users that have the "teacher" role
  const teachers = useQuery({
    queryKey: ["teachers-list"],
    queryFn: async () => {
      const { data: roleRows, error: rolesErr } = await supabase
        .from("user_roles").select("user_id").eq("role", "teacher");
      if (rolesErr) throw rolesErr;
      const ids = (roleRows ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles").select("id, full_name, email").in("id", ids);
      if (error) throw error;
      return data ?? [];
    },
  });

  const assignments = useQuery({
    queryKey: ["class-teachers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_teachers")
        .select("id, class_id, teacher_id, classes(name), profiles!class_teachers_teacher_id_fkey(full_name, email)");
      if (error) {
        // fallback: fetch separately if the join name differs
        const { data: rows, error: e2 } = await supabase.from("class_teachers").select("*");
        if (e2) throw e2;
        return rows as unknown as Array<{ id: string; class_id: string; teacher_id: string }>;
      }
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!classId || !teacherId) throw new Error("اختر الصف والمعلم");
      const { error } = await supabase.from("class_teachers").insert({ class_id: classId, teacher_id: teacherId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم التعيين"); setClassId(""); setTeacherId(""); qc.invalidateQueries({ queryKey: ["class-teachers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("class_teachers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["class-teachers"] }),
  });

  function nameForClass(id: string) {
    return classes.data?.find((c) => c.id === id)?.name ?? "—";
  }
  function nameForTeacher(id: string) {
    const t = teachers.data?.find((x) => x.id === id);
    return t?.full_name ?? t?.email ?? "—";
  }

  return (
    <section className="glass rounded-2xl p-6 space-y-4">
      <h3 className="text-xl font-bold flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" /> توزيع المعلمين على الصفوف</h3>
      <p className="text-sm text-muted-foreground">يحدد أي صفوف تظهر للمعلم في صفحة الحضور.</p>
      <div className="flex flex-wrap gap-2">
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger className="w-48"><SelectValue placeholder="الصف" /></SelectTrigger>
          <SelectContent>{classes.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={teacherId} onValueChange={setTeacherId}>
          <SelectTrigger className="w-56"><SelectValue placeholder="المعلم" /></SelectTrigger>
          <SelectContent>
            {teachers.data?.length === 0 && <div className="p-2 text-xs text-muted-foreground">لا يوجد معلمون. عيّن دور "معلم" في حسابات المستخدمين أولاً.</div>}
            {teachers.data?.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name ?? t.email}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => add.mutate()} disabled={add.isPending} className="gradient-primary text-primary-foreground">إضافة</Button>
      </div>

      <div className="space-y-2 pt-2">
        {assignments.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">لا يوجد تعيينات بعد.</p>
        )}
        {assignments.data?.map((a) => (
          <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
            <span className="flex-1 text-sm">
              <span className="font-semibold">{nameForClass(a.class_id)}</span>
              <span className="text-muted-foreground mx-2">←</span>
              {nameForTeacher(a.teacher_id)}
            </span>
            <Button size="sm" variant="ghost" onClick={() => remove.mutate(a.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
