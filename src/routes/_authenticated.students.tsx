import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/useRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Plus, Search, Upload, GraduationCap, ClipboardPaste, Trash2, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/students")({
  component: StudentsPage,
});

function StudentsPage() {
  const qc = useQueryClient();
  const { isAdmin, isMaster } = useRoles();
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
      const { data, error } = await q.limit(1000);
      if (error) throw error;
      return data;
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["students"] });
    qc.invalidateQueries({ queryKey: ["classes"] });
  };

  const delStudent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("students").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم حذف الطالب"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const classCounts = useMemo(() => {
    const m = new Map<string, number>();
    students.data?.forEach((s) => {
      if (s.class_id) m.set(s.class_id, (m.get(s.class_id) ?? 0) + 1);
    });
    return m;
  }, [students.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2"><GraduationCap className="h-7 w-7 text-primary" /> الطلاب والصفوف</h2>
          <p className="text-muted-foreground text-sm mt-1">{students.data?.length ?? 0} طالب · {classes.data?.length ?? 0} صف</p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <ClassDialog onSaved={refresh} />
            <BulkPasteDialog classes={classes.data ?? []} onSaved={refresh} />
            <StudentDialog classes={classes.data ?? []} onSaved={refresh} />
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
            {classes.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{classCounts.get(c.id) ? ` (${classCounts.get(c.id)})` : ""}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {classFilter === "all" && classes.data && classes.data.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {classes.data.map((c) => (
            <button key={c.id} onClick={() => setClassFilter(c.id)} className="glass rounded-xl p-3 text-right hover:bg-white/5 transition flex items-center justify-between">
              <div>
                <div className="font-semibold flex items-center gap-1">{c.name} {c.is_demo && <span className="text-[10px] px-1.5 rounded bg-accent/20 text-accent">تجريبي</span>}</div>
                <div className="text-xs text-muted-foreground">{classCounts.get(c.id) ?? 0} طالب</div>
              </div>
              <UsersIcon className="h-5 w-5 text-primary/60" />
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {students.data?.map((s) => (
          <div key={s.id} className="glass rounded-xl p-4 flex items-start justify-between gap-2 hover:bg-white/5 transition">
            <Link to="/students/$id" params={{ id: s.id }} className="flex-1 min-w-0">
              <div className="font-semibold truncate">{s.name}</div>
              <div className="text-xs text-muted-foreground">{(s.classes as { name: string } | null)?.name ?? "بدون صف"}</div>
              {s.parent_phone && <div className="text-xs text-muted-foreground mt-1" dir="ltr">{s.parent_phone}</div>}
            </Link>
            <div className="flex flex-col items-end gap-1">
              <div className={`text-xs font-bold px-2 py-1 rounded-full ${s.behavior_points >= 80 ? "bg-success/20 text-success" : s.behavior_points >= 60 ? "bg-warning/20 text-warning" : "bg-destructive/20 text-destructive"}`}>
                {s.behavior_points}
              </div>
              {isMaster && (
                <button onClick={() => { if (confirm(`حذف الطالب ${s.name}؟`)) delStudent.mutate(s.id); }} className="text-destructive/70 hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
        {students.data?.length === 0 && (
          <div className="col-span-full glass rounded-2xl p-10 text-center text-muted-foreground">
            <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-30" />
            لا يوجد طلاب بعد. ابدأ بإضافة صف ثم استعمل « لصق قائمة » لإضافة كل الطلاب دفعة واحدة.
          </div>
        )}
      </div>

      {isAdmin && classes.data && classes.data.length > 0 && (
        <ClassChips classes={classes.data} onDeleted={refresh} />
      )}
    </div>
  );
}

function ClassChips({ classes, onDeleted }: { classes: Array<{ id: string; name: string }>; onDeleted: () => void }) {
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("classes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("تم حذف الصف"); onDeleted(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <details className="glass rounded-xl p-3 text-sm">
      <summary className="cursor-pointer text-muted-foreground">حذف صف</summary>
      <div className="flex flex-wrap gap-2 mt-3">
        {classes.map((c) => (
          <span key={c.id} className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-border/40 flex items-center gap-2">
            {c.name}
            <button onClick={() => { if (confirm(`حذف الصف "${c.name}" وكل طلابه؟`)) del.mutate(c.id); }} className="hover:text-destructive">
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    </details>
  );
}

function ClassDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const save = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("classes").insert({ name, grade: grade || null }); if (error) throw error; },
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
      <DialogTrigger asChild><Button variant="outline" className="gap-2"><Plus className="h-4 w-4" /> طالب واحد</Button></DialogTrigger>
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

function splitLines(s: string) {
  return s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
}

function BulkPasteDialog({ classes, onSaved }: { classes: Array<{ id: string; name: string }>; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState("");
  const [namesText, setNamesText] = useState("");
  const [phonesText, setPhonesText] = useState("");
  const [busy, setBusy] = useState(false);

  const names = useMemo(() => splitLines(namesText), [namesText]);
  const phones = useMemo(() => splitLines(phonesText), [phonesText]);
  const rows = useMemo(() => names.map((name, i) => ({
    name, parent_phone: phones[i] || null,
  })), [names, phones]);
  const mismatched = phones.length > 0 && names.length !== phones.length;

  async function handleFile(file: File) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    const ns: string[] = [];
    const ps: string[] = [];
    for (const r of json) {
      const name = String(r["الاسم"] ?? r["name"] ?? r["Name"] ?? Object.values(r)[0] ?? "").trim();
      const ph = String(r["الجوال"] ?? r["phone"] ?? r["parent_phone"] ?? Object.values(r)[1] ?? "").trim();
      if (name) { ns.push(name); ps.push(ph); }
    }
    setNamesText(ns.join("\n"));
    setPhonesText(ps.join("\n"));
  }

  async function save() {
    if (!classId) return toast.error("اختر الصف أولاً");
    if (rows.length === 0) return toast.error("ألصق قائمة الأسماء أولاً");
    if (mismatched && !confirm(`عدد الأسماء (${names.length}) لا يطابق عدد الأرقام (${phones.length}). متابعة بالأسماء فقط؟`)) return;
    setBusy(true);
    const payload = rows.map((r) => ({ ...r, class_id: classId }));
    const { error } = await supabase.from("students").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`تم إضافة ${rows.length} طالب`);
    setNamesText(""); setPhonesText(""); setClassId(""); setOpen(false); onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 gradient-primary text-primary-foreground">
          <ClipboardPaste className="h-4 w-4" /> لصق قائمة
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ClipboardPaste className="h-5 w-5 text-primary" /> إضافة دفعة طلاب</DialogTitle>
          <DialogDescription>
            اختر الصف، ثم ألصق الأسماء في خانة، وأرقام أولياء الأمور في خانة أخرى — كل طالب في سطر مستقل. ستتم المطابقة سطر-بسطر.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>الصف المستهدف *</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue placeholder="اختر الصف" /></SelectTrigger>
              <SelectContent>
                {classes.length === 0 && <div className="p-2 text-sm text-muted-foreground">أضف صفاً أولاً</div>}
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end">
            <label className="text-xs text-primary cursor-pointer hover:underline flex items-center gap-1">
              <Upload className="h-3 w-3" /> أو ارفع Excel (عمودين: الاسم، الجوال)
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>أسماء الطلاب ({names.length})</Label>
              <Textarea
                rows={10} dir="auto"
                value={namesText} onChange={(e) => setNamesText(e.target.value)}
                placeholder={"أحمد بن محمد\nعبدالله سالم\nخالد ناصر"}
                className="font-medium"
              />
            </div>
            <div>
              <Label>أرقام أولياء الأمور ({phones.length}) — اختياري</Label>
              <Textarea
                rows={10} dir="ltr"
                value={phonesText} onChange={(e) => setPhonesText(e.target.value)}
                placeholder={"966500000001\n966500000002\n966500000003"}
                className="font-mono text-sm"
              />
            </div>
          </div>
          {mismatched && (
            <p className="text-xs text-warning">
              ⚠ عدد الأسماء ({names.length}) لا يطابق عدد الأرقام ({phones.length}). تأكد من ترتيب الأسطر.
            </p>
          )}
          {rows.length > 0 && (
            <div className="glass rounded-xl p-3 max-h-48 overflow-y-auto text-sm space-y-1">
              <div className="text-xs font-semibold text-muted-foreground mb-2">معاينة:</div>
              {rows.slice(0, 30).map((r, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span className="truncate">{i + 1}. {r.name}</span>
                  <span className="text-muted-foreground text-xs shrink-0" dir="ltr">{r.parent_phone ?? "—"}</span>
                </div>
              ))}
              {rows.length > 30 && <p className="text-xs text-muted-foreground text-center pt-1">+{rows.length - 30} أكثر…</p>}
            </div>
          )}
          <Button onClick={save} disabled={!classId || rows.length === 0 || busy} className="w-full gradient-primary text-primary-foreground">
            {busy ? "جاري الحفظ..." : `حفظ ${rows.length || ""} طالب`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
