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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { FileText, Plus, Check, X, Paperclip, FileDown, Clock } from "lucide-react";
import { toast } from "sonner";
import { uploadAttachment, getAttachmentUrl } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/leaves")({
  component: LeavesPage,
});

type LeaveType = "full_day" | "partial_leave" | "teacher_absence_notice";
const TYPE_LABEL: Record<LeaveType, string> = {
  full_day: "إجازة يوم كامل",
  partial_leave: "استئذان جزئي من الدوام",
  teacher_absence_notice: "إشعار غياب معلم",
};

function LeavesPage() {
  const { user } = useAuth();
  const { isAdmin } = useRoles();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["leaves"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leave_requests").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set(data.map((r) => r.employee_id)));
      const profiles = ids.length
        ? (await supabase.from("profiles").select("id, full_name").in("id", ids)).data ?? []
        : [];
      const nameMap = new Map(profiles.map((p) => [p.id, p.full_name]));
      return data.map((r) => ({ ...r, employee_name: nameMap.get(r.employee_id) ?? null }));
    },
  });

  useEffect(() => {
    if (!isAdmin || !list.data) return;
    if (!list.data.some((r) => r.unseen_admin)) return;
    supabase.from("leave_requests").update({ unseen_admin: false }).eq("unseen_admin", true)
      .then(() => qc.invalidateQueries({ queryKey: ["badge-counts"] }));
  }, [isAdmin, list.data, qc]);

  const review = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("leave_requests").update({ status, reviewer_id: user?.id }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم"); qc.invalidateQueries({ queryKey: ["leaves"] }); },
  });

  async function openAttachment(path: string) {
    try {
      const url = await getAttachmentUrl(path);
      window.open(url, "_blank");
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2"><FileText className="h-7 w-7 text-primary" /> {isAdmin ? "اعتماد الإجازات" : "طلبات الإجازة"}</h2>
        </div>
        <NewLeaveDialog onSaved={() => qc.invalidateQueries({ queryKey: ["leaves"] })} />
      </div>

      <div className="space-y-2">
        {list.data?.map((r) => {
          const t = (r.leave_type as LeaveType) ?? "full_day";
          return (
            <div key={r.id} className="glass rounded-xl p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="font-semibold flex items-center gap-2">
                  {r.employee_name ?? "—"}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary">{TYPE_LABEL[t]}</span>
                  {r.attachment_path && (
                    <button onClick={() => openAttachment(r.attachment_path!)} className="text-primary hover:underline text-xs inline-flex items-center gap-1">
                      <FileDown className="h-3 w-3" /> الملف
                    </button>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">{r.reason}</div>
                <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                  <span>{r.start_date}{r.end_date !== r.start_date ? ` → ${r.end_date}` : ""}</span>
                  {t === "partial_leave" && r.leave_from && (
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> خروج: {r.leave_from}</span>
                  )}
                  {t === "partial_leave" && r.will_return && r.expected_return && (
                    <span className="inline-flex items-center gap-1 text-success"><Clock className="h-3 w-3" /> رجوع: {r.expected_return}</span>
                  )}
                  {t === "partial_leave" && r.will_return === false && <span className="text-warning">لن يعود اليوم</span>}
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${r.status === "approved" ? "bg-success/20 text-success" : r.status === "rejected" ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning"}`}>
                {r.status === "pending" ? "قيد المراجعة" : r.status === "approved" ? "معتمدة" : "مرفوضة"}
              </span>
              {isAdmin && r.status === "pending" && (
                <div className="flex gap-1">
                  <Button size="sm" onClick={() => review.mutate({ id: r.id, status: "approved" })} className="bg-success text-success-foreground"><Check className="h-4 w-4" /></Button>
                  <Button size="sm" onClick={() => review.mutate({ id: r.id, status: "rejected" })} className="bg-destructive text-destructive-foreground"><X className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
          );
        })}
        {list.data?.length === 0 && <div className="glass rounded-2xl p-10 text-center text-muted-foreground">لا توجد طلبات إجازة</div>}
      </div>
    </div>
  );
}

function NewLeaveDialog({ onSaved }: { onSaved: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>("full_day");
  const [reason, setReason] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [leaveFrom, setLeaveFrom] = useState("");
  const [willReturn, setWillReturn] = useState(false);
  const [expectedReturn, setExpectedReturn] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      let attachment_path: string | null = null;
      if (file) attachment_path = await uploadAttachment(file, "leaves");
      const today2 = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from("leave_requests").insert({
        employee_id: user!.id,
        leave_type: leaveType,
        reason,
        start_date: start || today2,
        end_date: leaveType === "full_day" ? (end || start || today2) : (start || today2),
        attachment_path,
        leave_from: leaveType === "partial_leave" ? (leaveFrom || null) : null,
        will_return: leaveType === "partial_leave" ? willReturn : null,
        expected_return: leaveType === "partial_leave" && willReturn ? (expectedReturn || null) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إرسال الطلب");
      setOpen(false);
      setReason(""); setStart(""); setEnd(""); setLeaveFrom(""); setExpectedReturn(""); setWillReturn(false); setFile(null);
      setLeaveType("full_day");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="gap-2 gradient-primary text-primary-foreground"><Plus className="h-4 w-4" /> طلب جديد</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>طلب إجازة / إشعار غياب</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>نوع الطلب</Label>
            <Select value={leaveType} onValueChange={(v) => setLeaveType(v as LeaveType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full_day">{TYPE_LABEL.full_day}</SelectItem>
                <SelectItem value="partial_leave">{TYPE_LABEL.partial_leave}</SelectItem>
                <SelectItem value="teacher_absence_notice">{TYPE_LABEL.teacher_absence_notice}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div><Label>السبب</Label><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></div>

          {leaveType === "full_day" && (
            <div className="grid grid-cols-2 gap-2">
              <div><Label>من</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
              <div><Label>إلى</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
            </div>
          )}

          {leaveType === "partial_leave" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>التاريخ</Label><Input type="date" value={start || today} onChange={(e) => setStart(e.target.value)} /></div>
                <div><Label>وقت الخروج</Label><Input type="time" value={leaveFrom} onChange={(e) => setLeaveFrom(e.target.value)} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={willReturn} onChange={(e) => setWillReturn(e.target.checked)} className="h-4 w-4 accent-primary" />
                سأعود إلى المدرسة في وقت محدد
              </label>
              {willReturn && (
                <div><Label>وقت العودة المتوقع</Label><Input type="time" value={expectedReturn} onChange={(e) => setExpectedReturn(e.target.value)} /></div>
              )}
            </>
          )}

          {leaveType === "teacher_absence_notice" && (
            <div><Label>تاريخ الغياب</Label><Input type="date" value={start || today} onChange={(e) => setStart(e.target.value)} /></div>
          )}

          <div>
            <Label className="flex items-center gap-1"><Paperclip className="h-4 w-4" /> مرفق (شهادة/إجازة مرضية — PDF أو صورة)</Label>
            <Input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file && <p className="text-xs text-muted-foreground mt-1 truncate">{file.name}</p>}
          </div>

          <Button onClick={() => save.mutate()} disabled={!reason || save.isPending} className="w-full gradient-primary text-primary-foreground">
            {save.isPending ? "جاري الإرسال..." : "إرسال"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
