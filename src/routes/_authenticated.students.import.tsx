import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Upload, FileSpreadsheet, ClipboardPaste } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/students/import")({
  component: ImportPage,
});

type Row = { name: string; parent_phone?: string; parent_name?: string };

function ImportPage() {
  const navigate = useNavigate();
  const [classId, setClassId] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  const classes = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  async function handleFile(file: File) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    const parsed: Row[] = json.map((r) => ({
      name: String(r["الاسم"] ?? r["name"] ?? r["Name"] ?? "").trim(),
      parent_name: String(r["ولي الأمر"] ?? r["parent_name"] ?? "").trim() || undefined,
      parent_phone: String(r["الجوال"] ?? r["phone"] ?? r["parent_phone"] ?? "").trim() || undefined,
    })).filter((r) => r.name);
    setRows(parsed);
    toast.success(`تم قراءة ${parsed.length} طالباً`);
  }

  function handlePaste(text: string) {
    const parsed: Row[] = text.split("\n").map((line) => {
      const parts = line.split(/[\t,|]/).map((p) => p.trim());
      return { name: parts[0], parent_name: parts[1], parent_phone: parts[2] };
    }).filter((r) => r.name);
    setRows(parsed);
    toast.success(`تم قراءة ${parsed.length} طالباً`);
  }

  async function save() {
    if (!classId) return toast.error("اختر الصف أولاً");
    if (rows.length === 0) return toast.error("لا توجد بيانات");
    setBusy(true);
    const payload = rows.map((r) => ({ ...r, class_id: classId }));
    const { error } = await supabase.from("students").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`تم استيراد ${rows.length} طالب`);
    navigate({ to: "/students" });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-3xl font-bold flex items-center gap-2"><Upload className="h-7 w-7 text-primary" /> استيراد الطلاب</h2>
        <p className="text-muted-foreground text-sm mt-1">ثلاث طرق لإضافة الطلاب دفعة واحدة</p>
      </div>

      <div className="glass rounded-2xl p-6 space-y-4">
        <div>
          <Label>الصف المستهدف</Label>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger><SelectValue placeholder="اختر الصف" /></SelectTrigger>
            <SelectContent>
              {classes.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="excel">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="excel" className="gap-2"><FileSpreadsheet className="h-4 w-4" /> ملف Excel</TabsTrigger>
            <TabsTrigger value="paste" className="gap-2"><ClipboardPaste className="h-4 w-4" /> لصق نص</TabsTrigger>
          </TabsList>
          <TabsContent value="excel" className="space-y-2">
            <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="block w-full text-sm file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground file:font-semibold" />
            <p className="text-xs text-muted-foreground">الأعمدة المتوقعة: الاسم، ولي الأمر، الجوال</p>
          </TabsContent>
          <TabsContent value="paste">
            <Textarea rows={8} placeholder="انسخ من Excel أو اكتب: اسم، ولي الأمر، الجوال — كل طالب في سطر" onChange={(e) => handlePaste(e.target.value)} />
          </TabsContent>
        </Tabs>

        {rows.length > 0 && (
          <div className="glass rounded-xl p-3 max-h-60 overflow-y-auto text-sm space-y-1">
            {rows.slice(0, 50).map((r, i) => <div key={i} className="flex justify-between"><span>{r.name}</span><span className="text-muted-foreground" dir="ltr">{r.parent_phone ?? ""}</span></div>)}
            {rows.length > 50 && <p className="text-xs text-muted-foreground text-center">+{rows.length - 50} المزيد...</p>}
          </div>
        )}

        <Button onClick={save} disabled={!classId || rows.length === 0 || busy} className="w-full gradient-primary text-primary-foreground">
          {busy ? "..." : `حفظ ${rows.length} طالب`}
        </Button>
      </div>
    </div>
  );
}
