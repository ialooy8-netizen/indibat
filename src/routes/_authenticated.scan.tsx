import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { QrCode, ScanLine, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/scan")({
  component: ScanPage,
});

type Status = "present" | "absent" | "late";

function ScanPage() {
  const { user } = useAuth();
  const { isAdmin, isTeacher } = useRoles();
  const qc = useQueryClient();
  const [classId, setClassId] = useState("");
  const [period, setPeriod] = useState(1);
  const [status, setStatus] = useState<Status>("present");
  const [scanning, setScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<{ name: string; when: number } | null>(null);
  const readerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const classes = useQuery({
    queryKey: ["scan-classes", user?.id, isAdmin, isTeacher],
    enabled: !!user,
    queryFn: async () => {
      if (isAdmin) {
        const { data } = await supabase.from("classes").select("id,name").order("name");
        return data ?? [];
      }
      if (isTeacher) {
        const { data } = await supabase.from("class_teachers").select("classes(id,name)").eq("teacher_id", user!.id);
        return (data ?? []).map((r) => (r as { classes: { id: string; name: string } | null }).classes).filter(Boolean) as { id: string; name: string }[];
      }
      return [];
    },
  });

  const mark = useMutation({
    mutationFn: async (studentId: string) => {
      const { data: st } = await supabase.from("students").select("id,name,class_id").eq("id", studentId).maybeSingle();
      if (!st) throw new Error("طالب غير موجود");
      if (classId && st.class_id !== classId) throw new Error(`الطالب ليس ضمن الصف المحدد`);
      const { error } = await supabase.from("attendance").upsert({
        student_id: studentId, date: today, period, status, recorded_by: user?.id,
      }, { onConflict: "student_id,date,period" });
      if (error) throw error;
      return st.name;
    },
    onSuccess: (name) => {
      setLastScanned({ name, when: Date.now() });
      toast.success(`${name} — ${status === "present" ? "حاضر" : status === "late" ? "متأخر" : "غائب"}`);
      qc.invalidateQueries({ queryKey: ["attendance-day"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطأ"),
  });

  useEffect(() => {
    if (!scanning || !readerRef.current) return;
    let cancelled = false;
    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decoded) => {
            const now = Date.now();
            if (lastCodeRef.current && lastCodeRef.current.code === decoded && now - lastCodeRef.current.at < 3000) return;
            lastCodeRef.current = { code: decoded, at: now };
            const id = decoded.startsWith("student:") ? decoded.slice(8) : decoded;
            mark.mutate(id);
          },
          () => { /* ignore per-frame errors */ },
        );
      } catch (e) {
        toast.error("تعذّر تشغيل الكاميرا");
        console.error(e);
        setScanning(false);
      }
    })();
    return () => {
      cancelled = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = scannerRef.current as any;
      if (s) { s.stop().catch(() => {}).then(() => s.clear?.()); scannerRef.current = null; }
    };
  }, [scanning, mark]);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold flex items-center gap-2"><QrCode className="h-7 w-7 text-primary" /> الحضور عبر QR</h2>
      <div className="glass rounded-2xl p-4 grid md:grid-cols-3 gap-3">
        <div>
          <label className="text-sm text-muted-foreground">الصف</label>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger><SelectValue placeholder="اختر (اختياري للتحقق)" /></SelectTrigger>
            <SelectContent>
              {(classes.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm text-muted-foreground">الحصة</label>
          <Select value={String(period)} onValueChange={(v) => setPeriod(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1,2,3,4,5,6,7,8].map((p) => <SelectItem key={p} value={String(p)}>الحصة {p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm text-muted-foreground">الحالة عند المسح</label>
          <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="present">حاضر</SelectItem>
              <SelectItem value="late">متأخر</SelectItem>
              <SelectItem value="absent">غائب</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2"><ScanLine className="h-5 w-5" /> الماسح</h3>
          <Button onClick={() => setScanning((s) => !s)} variant={scanning ? "destructive" : "default"}>
            {scanning ? "إيقاف" : "تشغيل الكاميرا"}
          </Button>
        </div>
        <div id="qr-reader" ref={readerRef} className="mx-auto max-w-md aspect-square bg-black/20 rounded-xl overflow-hidden" />
        {!scanning && <p className="text-sm text-muted-foreground text-center mt-3">اسمح بالوصول للكاميرا. وجّه رمز QR الخاص بالطالب أمامها.</p>}
        {lastScanned && (
          <div className="mt-4 flex items-center gap-2 justify-center text-sm p-3 rounded-lg bg-success/10 text-success">
            <CheckCircle2 className="h-4 w-4" />
            آخر تسجيل: {lastScanned.name} — {status === "present" ? <><CheckCircle2 className="h-3 w-3 inline"/> حاضر</> : status === "late" ? <><Clock className="h-3 w-3 inline"/> متأخر</> : <><XCircle className="h-3 w-3 inline"/> غائب</>}
          </div>
        )}
      </div>
    </div>
  );
}
