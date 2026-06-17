import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, Plus, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/facilities")({
  component: FacilitiesPage,
});

function FacilitiesPage() {
  const { user } = useAuth();
  const { isAdmin } = useRoles();
  const qc = useQueryClient();

  const config = useQuery({
    queryKey: ["facility-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("facility_config").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const bookings = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("resource_bookings").select("*, profiles!resource_bookings_employee_id_fkey(full_name)").order("booking_date", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  if (isAdmin && bookings.data?.some((r) => r.unseen_admin)) {
    supabase.from("resource_bookings").update({ unseen_admin: false }).eq("unseen_admin", true).then(() => qc.invalidateQueries({ queryKey: ["badge-counts"] }));
  }

  const review = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("resource_bookings").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bookings"] }); toast.success("تم"); },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-3xl font-bold flex items-center gap-2"><Building2 className="h-7 w-7 text-primary" /> حجز المرافق</h2>
        <NewBookingDialog
          resources={config.data?.resources ?? []}
          periods={config.data?.periods_per_day ?? 7}
          onSaved={() => qc.invalidateQueries({ queryKey: ["bookings"] })}
        />
      </div>

      <div className="space-y-2">
        {bookings.data?.map((r) => (
          <div key={r.id} className="glass rounded-xl p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="font-semibold">{r.resource}</div>
              <div className="text-xs text-muted-foreground">{(r.profiles as { full_name: string | null } | null)?.full_name ?? "—"} · {r.booking_date} · {r.period}</div>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${r.status === "approved" ? "bg-success/20 text-success" : r.status === "rejected" ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning"}`}>
              {{ pending: "بانتظار", approved: "معتمد", rejected: "مرفوض" }[r.status]}
            </span>
            {isAdmin && r.status === "pending" && (
              <div className="flex gap-1">
                <Button size="sm" onClick={() => review.mutate({ id: r.id, status: "approved" })} className="bg-success text-success-foreground"><Check className="h-4 w-4" /></Button>
                <Button size="sm" onClick={() => review.mutate({ id: r.id, status: "rejected" })} className="bg-destructive text-destructive-foreground"><X className="h-4 w-4" /></Button>
              </div>
            )}
          </div>
        ))}
        {bookings.data?.length === 0 && <div className="glass rounded-2xl p-10 text-center text-muted-foreground">لا توجد حجوزات</div>}
      </div>
    </div>
  );
}

function NewBookingDialog({ resources, periods, onSaved }: { resources: string[]; periods: number; onSaved: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [resource, setResource] = useState("");
  const [date, setDate] = useState("");
  const [period, setPeriod] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("resource_bookings").insert({ employee_id: user!.id, resource, booking_date: date, period });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الحجز"); setOpen(false); setResource(""); setDate(""); setPeriod(""); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="gap-2 gradient-primary text-primary-foreground"><Plus className="h-4 w-4" /> حجز جديد</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>حجز مرفق</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>المرفق</Label>
            <Select value={resource} onValueChange={setResource}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>{resources.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>التاريخ</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label>الحصة</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>{Array.from({ length: periods }, (_, i) => i + 1).map((p) => <SelectItem key={p} value={`الحصة ${p}`}>الحصة {p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={() => save.mutate()} disabled={!resource || !date || !period || save.isPending} className="w-full gradient-primary text-primary-foreground">إرسال</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
