import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Printer, Plus, Check, X, Paperclip, FileDown, Lock, ShieldCheck, AlertTriangle, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { uploadAttachment, getAttachmentUrl } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/print")({
  component: PrintPage,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "بانتظار الطباعة",
  pending_principal: "بانتظار اعتماد المدير",
  approved: "معتمد",
  printed: "تمت الطباعة",
  rejected: "مرفوض",
};

function PrintPage() {
  const { user } = useAuth();
  const { isAdmin, isPrintManager } = useRoles();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["prints"],
    queryFn: async () => {
      const { data, error } = await supabase.from("print_requests").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set(data.map((r) => r.employee_id)));
      const profiles = ids.length ? (await supabase.from("profiles").select("id, full_name").in("id", ids)).data ?? [] : [];
      const nameMap = new Map(profiles.map((p) => [p.id, p.full_name]));
      // Print manager doesn't see confidential docs still awaiting principal approval
      let rows = data.map((r) => ({ ...r, employee_name: nameMap.get(r.employee_id) ?? null }));
      if (!isAdmin && isPrintManager) {
        rows = rows.filter((r) => r.status !== "pending_principal");
      }
      return rows;
    },
  });

  useEffect(() => {
    const canReview = isAdmin || isPrintManager;
    if (!canReview || !list.data) return;
    if (!list.data.some((r) => r.unseen_admin)) return;
    supabase.from("print_requests").update({ unseen_admin: false }).eq("unseen_admin", true)
      .then(() => qc.invalidateQueries({ queryKey: ["badge-counts"] }));
  }, [isAdmin, isPrintManager, list.data, qc]);

  const review = useMutation({
    mutationFn: async ({ id, status, principalOk }: { id: string; status: "pending" | "pending_principal" | "approved" | "printed" | "rejected"; principalOk?: boolean }) => {
      const { error } = await supabase.from("print_requests").update({
        status,
        ...(principalOk ? { principal_approved_at: new Date().toISOString(), principal_approved_by: user?.id } : {}),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prints"] }); toast.success("تم"); },
  });

  async function openAttachment(path: string) {
    try { window.open(await getAttachmentUrl(path), "_blank"); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-3xl font-bold flex items-center gap-2"><Printer className="h-7 w-7 text-primary" /> طلبات الطباعة</h2>
        <div className="flex flex-wrap gap-2">
          {(isPrintManager || isAdmin) && <NotifyStaffDialog />}
          <NewPrintDialog onSaved={() => qc.invalidateQueries({ queryKey: ["prints"] })} />
        </div>
      </div>

      <div className="space-y-2">
        {list.data?.map((r) => (
          <div key={r.id} className={`glass rounded-xl p-4 flex flex-wrap items-center gap-3 ${r.is_confidential ? "border-r-4 border-accent" : ""}`}>
            <div className="flex-1 min-w-[200px]">
              <div className="font-semibold flex items-center gap-2">
                {r.is_confidential && <span title="مستند سري"><Lock className="h-4 w-4 text-accent" /></span>}
                {r.title}
                {r.attachment_path && (
                  <button onClick={() => openAttachment(r.attachment_path!)} className="text-primary hover:underline text-xs inline-flex items-center gap-1">
                    <FileDown className="h-3 w-3" /> الملف
                  </button>
                )}
              </div>
              <div className="text-xs text-muted-foreground">{r.employee_name ?? "—"} · {r.copies} نسخة{r.is_confidential ? " · سري" : ""}</div>
              {r.principal_approved_at && (
                <div className="text-xs text-success mt-1 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> اعتمده المدير
                </div>
              )}
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${
              r.status === "printed" ? "bg-success/20 text-success"
              : r.status === "approved" ? "bg-primary/20 text-primary"
              : r.status === "rejected" ? "bg-destructive/20 text-destructive"
              : r.status === "pending_principal" ? "bg-accent/20 text-accent"
              : "bg-warning/20 text-warning"
            }`}>
              {STATUS_LABEL[r.status] ?? r.status}
            </span>

            {/* Principal/admin approves confidential prints */}
            {isAdmin && r.status === "pending_principal" && (
              <div className="flex gap-1">
                <Button size="sm" onClick={() => review.mutate({ id: r.id, status: "pending", principalOk: true })} className="gap-1 bg-success text-success-foreground">
                  <ShieldCheck className="h-4 w-4" /> أعتمد ويُرسل للطباعة
                </Button>
                <Button size="sm" onClick={() => review.mutate({ id: r.id, status: "rejected" })} className="bg-destructive text-destructive-foreground"><X className="h-4 w-4" /></Button>
              </div>
            )}

            {/* Print manager workflow */}
            {(isAdmin || isPrintManager) && r.status === "pending" && (
              <div className="flex gap-1">
                <Button size="sm" onClick={() => review.mutate({ id: r.id, status: "approved" })} className="bg-primary text-primary-foreground"><Check className="h-4 w-4" /></Button>
                <Button size="sm" onClick={() => review.mutate({ id: r.id, status: "rejected" })} className="bg-destructive text-destructive-foreground"><X className="h-4 w-4" /></Button>
              </div>
            )}
            {(isAdmin || isPrintManager) && r.status === "approved" && (
              <Button size="sm" onClick={() => review.mutate({ id: r.id, status: "printed" })} className="bg-success text-success-foreground">تمت الطباعة</Button>
            )}
          </div>
        ))}
        {list.data?.length === 0 && <div className="glass rounded-2xl p-10 text-center text-muted-foreground">لا توجد طلبات</div>}
      </div>
    </div>
  );
}

function NewPrintDialog({ onSaved }: { onSaved: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [copies, setCopies] = useState(1);
  const [confidential, setConfidential] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      let attachment_path: string | null = null;
      if (file) attachment_path = await uploadAttachment(file, "print");
      const { error } = await supabase.from("print_requests").insert({
        employee_id: user!.id, title, copies,
        attachment_path,
        is_confidential: confidential,
        status: confidential ? "pending_principal" : "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(confidential ? "أُرسل إلى المدير للاعتماد" : "تم الإرسال للطباعة");
      setOpen(false); setTitle(""); setCopies(1); setFile(null); setConfidential(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="gap-2 gradient-primary text-primary-foreground"><Plus className="h-4 w-4" /> طلب طباعة</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>طلب طباعة</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>عنوان المستند</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>عدد النسخ</Label><Input type="number" min={1} value={copies} onChange={(e) => setCopies(Number(e.target.value))} /></div>
          <div>
            <Label className="flex items-center gap-1"><Paperclip className="h-4 w-4" /> الملف (PDF أو صورة)</Label>
            <Input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file && <p className="text-xs text-muted-foreground mt-1 truncate">{file.name}</p>}
          </div>
          <label className={`flex items-start gap-2 text-sm cursor-pointer p-3 rounded-lg border ${confidential ? "border-accent bg-accent/10" : "border-border/40"}`}>
            <input type="checkbox" checked={confidential} onChange={(e) => setConfidential(e.target.checked)} className="h-4 w-4 mt-0.5 accent-accent" />
            <span>
              <span className="font-semibold flex items-center gap-1"><Lock className="h-3.5 w-3.5" /> مستند سري (اختبارات، وثائق حساسة)</span>
              <span className="text-xs text-muted-foreground block mt-0.5">سيتم إرساله للمدير للاعتماد أولاً قبل وصوله لمسؤول الطباعة.</span>
            </span>
          </label>
          <Button onClick={() => save.mutate()} disabled={!title || save.isPending} className="w-full gradient-primary text-primary-foreground">
            {save.isPending ? "جاري الرفع..." : "إرسال"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NotifyStaffDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("تأخر في تنفيذ طلبات الطباعة");
  const [body, setBody] = useState("نعتذر عن أي تأخير. هناك مشكلة تقنية في الطابعة. سيتم استئناف الخدمة في أقرب وقت ممكن.");
  const [severity, setSeverity] = useState<"info" | "warning" | "critical">("warning");
  const qc = useQueryClient();
  const { user } = useAuth();

  const post = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("staff_notices").insert({
        posted_by: user?.id,
        category: "printer",
        title, body, severity, active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إخطار جميع الموظفين");
      qc.invalidateQueries({ queryKey: ["staff-notices-active"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-warning/50 text-warning hover:bg-warning/10">
          <AlertTriangle className="h-4 w-4" /> الإبلاغ عن عطل
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-warning" /> إخطار الموظفين بمشكلة الطباعة</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">سيظهر هذا الإخطار كشريط بارز لجميع الموظفين في كل صفحة حتى يتم إخفاؤه.</p>
          <div><Label>العنوان</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>التفاصيل</Label><Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} /></div>
          <div>
            <Label>درجة الأهمية</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {(["info", "warning", "critical"] as const).map((s) => (
                <Button key={s} type="button" variant={severity === s ? "default" : "outline"}
                  onClick={() => setSeverity(s)}
                  className={severity === s ? (s === "critical" ? "bg-destructive text-destructive-foreground" : s === "warning" ? "bg-warning text-warning-foreground" : "bg-primary text-primary-foreground") : ""}>
                  {s === "info" ? "معلومة" : s === "warning" ? "تحذير" : "عاجل"}
                </Button>
              ))}
            </div>
          </div>
          <Button onClick={() => post.mutate()} disabled={!title || post.isPending} className="w-full gradient-primary text-primary-foreground gap-2">
            <Megaphone className="h-4 w-4" /> {post.isPending ? "جاري الإرسال..." : "نشر الإخطار للجميع"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
