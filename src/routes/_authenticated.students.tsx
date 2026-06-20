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
import { Plus, Search, Upload, GraduationCap, ClipboardPaste, Trash2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

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
      const { data, error } = await q.limit(1000);
      if (error) throw error;
      return data;
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["students"] });
    qc.invalidateQueries({ queryKey: ["classes"] });
  };

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
            {classes.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isAdmin && classes.data && classes.data.length > 0 && (
        <ClassChips classes={classes.data} onDeleted={refresh} />
      )}

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
            لا يوجد طلاب بعد. ابدأ بإضافة صف ثم استعمل « لصق قائمة » لإضافة كل الطلاب دفعة واحدة.
          </div>
        )}
      </div>
    </div>
  );
}

function ClassChips({ classes, onDeleted }: { classes: Array<{ id: string; name: string }>; onDeleted: () => void }) {
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم حذف الصف"); onDeleted(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="flex flex-wrap gap-2">
      {classes.map((c) => (
        <span key={c.id} className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-border/40 flex items-center gap-2">
          {c.name}
          <button onClick={() => { if (confirm(`حذف الصف "${c.name}" وكل طلابه؟`)) del.mutate(c.id); }} className="hover:text-destructive">
            <Trash2 className="h-3 w-3" />
          </button>
        </span>
      ))}
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

type ParsedRow = { name: string; parent_name?: string; parent_phone?: string };

function parsePastedText(text: string): ParsedRow[] {
  return text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[\t,،|;]+/).map((p) => p.trim()).filter(Boolean);
      return { name: parts[0] ?? "", parent_name: parts[1] || undefined, parent_phone: parts[2] || undefined };
    })
    .filter((r) => r.name);
}

function BulkPasteDialog({ classes, onSaved }: { classes: Array<{ id: string; name: string }>; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => parsePastedText(text), [text]);

  async function handleFile(file: File) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    const lines = json.map((r) => {
      const name = String(r["الاسم"] ?? r["name"] ?? r["Name"] ?? Object.values(r)[0] ?? "").trim();
      const pn = String(r["ولي الأمر"] ?? r["parent_name"] ?? "").trim();
      const ph = String(r["الجوال"] ?? r["phone"] ?? r["parent_phone"] ?? "").trim();
      return [name, pn, ph].filter(Boolean).join(" | ");
    }).filter(Boolean);
    setText(lines.join("\n"));
  }

  async function save() {
    if (!classId) return toast.error("اختر الصف أولاً");
    if (rows.length === 0) return toast.error("الصق قائمة الطلاب أولاً");
    setBusy(true);
    const payload = rows.map((r) => ({ ...r, class_id: classId }));
    const { error } = await supabase.from("students").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`تم إضافة ${rows.length} طالب`);
    setText(""); setClassId(""); setOpen(false); onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 gradient-primary text-primary-foreground">
          <ClipboardPaste className="h-4 w-4" /> لصق قائمة
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ClipboardPaste className="h-5 w-5 text-primary" /> لصق قائمة طلاب</DialogTitle>
          <DialogDescription>
            اختر الصف ثم الصق الأسماء — اسم في كل سطر. يمكن إضافة ولي الأمر والجوال بفاصلة أو Tab.
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

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>قائمة الطلاب</Label>
              <label className="text-xs text-primary cursor-pointer hover:underline flex items-center gap-1">
                <Upload className="h-3 w-3" /> أو ارفع Excel
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </label>
            </div>
            <Textarea
              rows={10}
              dir="auto"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"أحمد محمد\nعبدالله سالم | والده | 966500000000\nخالد ناصر"}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {rows.length > 0 ? `✓ ${rows.length} طالب جاهز للحفظ` : "لم تتم إضافة أي طالب بعد"}
            </p>
          </div>

          {rows.length > 0 && (
            <div className="glass rounded-xl p-3 max-h-48 overflow-y-auto text-sm space-y-1">
              {rows.slice(0, 30).map((r, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span className="truncate">{i + 1}. {r.name}</span>
                  <span className="text-muted-foreground text-xs shrink-0" dir="ltr">{r.parent_phone ?? ""}</span>
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
