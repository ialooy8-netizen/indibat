import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/useRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Upload, GraduationCap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/students")({
  component: StudentsPage,
});

function StudentsPage() {
  const qc = useQueryClient();
  const { isAdmin } = useRoles();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");

  const classes = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const students = useQuery({
    queryKey: ["students", classFilter, search],
    queryFn: async () => {
      let q = supabase.from("students").select("*, classes(name)").order("name");
      if (classFilter !== "all") q = q.eq("class_id", classFilter);
      if (search) q = q.ilike("name", `%${search}%`);
      const { data, error } = await q.limit(500);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2"><GraduationCap className="h-7 w-7 text-primary" /> الطلاب والصفوف</h2>
          <p className="text-muted-foreground text-sm mt-1">{students.data?.length ?? 0} طالب</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <ClassDialog onSaved={() => qc.invalidateQueries({ queryKey: ["classes"] })} />
            <StudentDialog classes={classes.data ?? []} onSaved={() => qc.invalidateQueries({ queryKey: ["students"] })} />
            <Link to="/students/import"><Button variant="outline" className="gap-2"><Upload className="h-4 w-4" /> استيراد Excel</Button></Link>
          </div>
        )}
      </div>

      <div className="glass rounded-2xl p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="بحث بالاسم..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9" />
        </div>
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الصفوف</SelectItem>
            {classes.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {students.data?.map((s) => (
          <Link key={s.id} to="/students/$id" params={{ id: s.id }} className="glass rounded-xl p-4 hover:bg-white/5 transition">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold truncate">{s.name}</div>
                <div className="text-xs text-muted-foreground">{(s.classes as { name: string } | null)?.name ?? "بدون صف"}</div>
              </div>
              <div className={`text-xs font-bold px-2 py-1 rounded-full ${s.behavior_points >= 80 ? "bg-success/20 text-success" : s.behavior_points >= 60 ? "bg-warning/20 text-warning" : "bg-destructive/20 text-destructive"}`}>
                {s.behavior_points}
              </div>
            </div>
          </Link>
        ))}
        {students.data?.length === 0 && (
          <div className="col-span-full glass rounded-2xl p-10 text-center text-muted-foreground">
            <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-30" />
            لا يوجد طلاب بعد. ابدأ بإضافة صف ثم استيراد قائمة الطلاب.
          </div>
        )}
      </div>
    </div>
  );
}

function ClassDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("classes").insert({ name, grade: grade || null });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم إضافة الصف"); setOpen(false); setName(""); setGrade(""); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="gap-2"><Plus className="h-4 w-4" /> صف جديد</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>إضافة صف</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>اسم الصف</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثل: 5/أ" /></div>
          <div><Label>المرحلة (اختياري)</Label><Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="مثل: ابتدائي" /></div>
          <Button onClick={() => save.mutate()} disabled={!name || save.isPending} className="w-full gradient-primary text-primary-foreground">حفظ</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StudentDialog({ classes, onSaved }: { classes: Array<{ id: string; name: string }>; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", class_id: "", parent_phone: "", parent_name: "" });
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("students").insert({
        name: form.name, class_id: form.class_id || null,
        parent_phone: form.parent_phone || null, parent_name: form.parent_name || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم إضافة الطالب"); setOpen(false); setForm({ name: "", class_id: "", parent_phone: "", parent_name: "" }); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="gap-2 gradient-primary text-primary-foreground"><Plus className="h-4 w-4" /> طالب جديد</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>إضافة طالب</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>اسم الطالب</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>الصف</Label>
            <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })}>
              <SelectTrigger><SelectValue placeholder="اختر صفاً" /></SelectTrigger>
              <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>اسم ولي الأمر</Label><Input value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} /></div>
          <div><Label>جوال ولي الأمر</Label><Input value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} dir="ltr" placeholder="9665XXXXXXXX" /></div>
          <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending} className="w-full gradient-primary text-primary-foreground">حفظ</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
