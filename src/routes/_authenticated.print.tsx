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
import { Printer, Plus, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/print")({
  component: PrintPage,
});

function PrintPage() {
  const { user } = useAuth();
  const { isAdmin, isPrintManager } = useRoles();
  const canReview = isAdmin || isPrintManager;
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["prints"],
    queryFn: async () => {
      const { data, error } = await supabase.from("print_requests").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set(data.map((r) => r.employee_id)));
      const profiles = ids.length ? (await supabase.from("profiles").select("id, full_name").in("id", ids)).data ?? [] : [];
      const nameMap = new Map(profiles.map((p) => [p.id, p.full_name]));
      return data.map((r) => ({ ...r, employee_name: nameMap.get(r.employee_id) ?? null }));
    },
  });

  useEffect(() => {
    if (!canReview || !list.data) return;
    if (!list.data.some((r) => r.unseen_admin)) return;
    supabase.from("print_requests").update({ unseen_admin: false }).eq("unseen_admin", true)
      .then(() => qc.invalidateQueries({ queryKey: ["badge-counts"] }));
  }, [canReview, list.data, qc]);

  const review = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "printed" | "rejected" }) => {
      const { error } = await supabase.from("print_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prints"] }); toast.success("تم"); },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-3xl font-bold flex items-center gap-2"><Printer className="h-7 w-7 text-primary" /> طلبات الطباعة</h2>
        <NewPrintDialog onSaved={() => qc.invalidateQueries({ queryKey: ["prints"] })} />
      </div>

      <div className="space-y-2">
        {list.data?.map((r) => (
          <div key={r.id} className="glass rounded-xl p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="font-semibold">{r.title}</div>
              <div className="text-xs text-muted-foreground">{r.employee_name ?? "—"} · {r.copies} نسخة</div>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${r.status === "printed" ? "bg-success/20 text-success" : r.status === "approved" ? "bg-primary/20 text-primary" : r.status === "rejected" ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning"}`}>
              {{ pending: "بانتظار", approved: "معتمد", printed: "تمت الطباعة", rejected: "مرفوض" }[r.status]}
            </span>
            {canReview && r.status !== "printed" && r.status !== "rejected" && (
              <div className="flex gap-1">
                {r.status === "pending" && <Button size="sm" onClick={() => review.mutate({ id: r.id, status: "approved" })} className="bg-primary text-primary-foreground"><Check className="h-4 w-4" /></Button>}
                {r.status === "approved" && <Button size="sm" onClick={() => review.mutate({ id: r.id, status: "printed" })} className="bg-success text-success-foreground">تم</Button>}
                <Button size="sm" onClick={() => review.mutate({ id: r.id, status: "rejected" })} className="bg-destructive text-destructive-foreground"><X className="h-4 w-4" /></Button>
              </div>
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
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("print_requests").insert({ employee_id: user!.id, title, copies });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم"); setOpen(false); setTitle(""); setCopies(1); onSaved(); },
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
          <Button onClick={() => save.mutate()} disabled={!title || save.isPending} className="w-full gradient-primary text-primary-foreground">إرسال</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
