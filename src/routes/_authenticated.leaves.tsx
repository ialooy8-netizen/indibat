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
import { FileText, Plus, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/leaves")({
  component: LeavesPage,
});

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2"><FileText className="h-7 w-7 text-primary" /> {isAdmin ? "اعتماد الإجازات" : "طلبات الإجازة"}</h2>
        </div>
        <NewLeaveDialog onSaved={() => qc.invalidateQueries({ queryKey: ["leaves"] })} />
      </div>

      <div className="space-y-2">
        {list.data?.map((r) => (
          <div key={r.id} className="glass rounded-xl p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="font-semibold">{r.employee_name ?? "—"}</div>
              <div className="text-sm text-muted-foreground">{r.reason}</div>
              <div className="text-xs text-muted-foreground mt-1">{r.start_date} → {r.end_date}</div>
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
        ))}
        {list.data?.length === 0 && <div className="glass rounded-2xl p-10 text-center text-muted-foreground">لا توجد طلبات إجازة</div>}
      </div>
    </div>
  );
}

function NewLeaveDialog({ onSaved }: { onSaved: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leave_requests").insert({ employee_id: user!.id, reason, start_date: start, end_date: end });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم إرسال الطلب"); setOpen(false); setReason(""); setStart(""); setEnd(""); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="gap-2 gradient-primary text-primary-foreground"><Plus className="h-4 w-4" /> طلب جديد</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>طلب إجازة</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>السبب</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>من</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><Label>إلى</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <Button onClick={() => save.mutate()} disabled={!reason || !start || !end || save.isPending} className="w-full gradient-primary text-primary-foreground">إرسال</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
