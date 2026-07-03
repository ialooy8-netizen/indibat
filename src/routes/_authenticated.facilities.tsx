import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Building2, Plus, Trash2, CalendarDays, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { FeatureHelp } from "@/components/app/FeatureHelp";

export const Route = createFileRoute("/_authenticated/facilities")({
  component: FacilitiesPage,
});

function FacilitiesPage() {
  const { user } = useAuth();
  const { isAdmin } = useRoles();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [gridDate, setGridDate] = useState(today);

  const config = useQuery({
    queryKey: ["facility-config"],
    queryFn: async () => (await supabase.from("facility_config").select("*").eq("id", 1).maybeSingle()).data,
  });

  const bookings = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("resource_bookings").select("*").order("booking_date", { ascending: false }).limit(300);
      if (error) throw error;
      const ids = Array.from(new Set(data.map((r) => r.employee_id)));
      const profiles = ids.length ? (await supabase.from("profiles").select("id, full_name").in("id", ids)).data ?? [] : [];
      const nameMap = new Map(profiles.map((p) => [p.id, p.full_name]));
      return data.map((r) => ({ ...r, employee_name: nameMap.get(r.employee_id) ?? null }));
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("resource_bookings").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("تم حذف الحجز"); qc.invalidateQueries({ queryKey: ["bookings"] }); },
  });

  const resources: string[] = config.data?.resources ?? [];
  const periods = config.data?.periods_per_day ?? 7;

  type Booking = NonNullable<typeof bookings.data>[number];
  const gridMap = useMemo(() => {
    const m = new Map<string, Map<string, Booking>>();
    for (const b of bookings.data ?? []) {
      if (b.booking_date !== gridDate) continue;
      if (!m.has(b.resource)) m.set(b.resource, new Map());
      m.get(b.resource)!.set(b.period, b);
    }
    return m;
  }, [bookings.data, gridDate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" /> {isAdmin ? "حجوزات المرافق" : "حجز المرافق"}
            <FeatureHelp title="حجوزات المرافق">
              <p>احجز مرفقاً (قاعة، مسرح، مختبر...) لحصة محددة في تاريخ محدد.</p>
              <p>الحجز فوري لا يحتاج اعتماد. الجدول اليومي يعرض الفترات المشغولة والمتاحة بلون مختلف.</p>
            </FeatureHelp>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">الحجز فوري لا يحتاج اعتماد.</p>
        </div>
        <NewBookingDialog
          resources={resources}
          periods={periods}
          onSaved={() => qc.invalidateQueries({ queryKey: ["bookings"] })}
        />
      </div>

      <Tabs defaultValue="grid">
        <TabsList>
          <TabsTrigger value="grid">الجدول اليومي</TabsTrigger>
          <TabsTrigger value="list">قائمة الحجوزات</TabsTrigger>
        </TabsList>

        <TabsContent value="grid" className="space-y-3">
          <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
            <Label className="text-sm">التاريخ:</Label>
            <Input type="date" value={gridDate} onChange={(e) => setGridDate(e.target.value)} className="w-auto" />
            <div className="flex items-center gap-2 text-xs text-muted-foreground ms-auto">
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-success/40 border border-success/40"></span> متاح</span>
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-destructive/30 border border-destructive/40"></span> محجوز</span>
            </div>
          </div>

          {resources.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center text-muted-foreground">لا توجد مرافق — أضفها من الإعدادات</div>
          ) : (
            <div className="glass rounded-2xl p-3 overflow-x-auto">
              <table className="w-full text-xs sm:text-sm border-separate border-spacing-1 min-w-[700px]">
                <thead>
                  <tr>
                    <th className="p-2 text-muted-foreground font-normal text-start">المرفق</th>
                    {Array.from({ length: periods }, (_, i) => i + 1).map((p) => (
                      <th key={p} className="p-2 text-muted-foreground font-normal">حصة {p}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resources.map((r) => (
                    <tr key={r}>
                      <td className="p-2 font-semibold whitespace-nowrap">{r}</td>
                      {Array.from({ length: periods }, (_, i) => i + 1).map((p) => {
                        const label = `الحصة ${p}`;
                        const b = gridMap.get(r)?.get(label);
                        if (b) {
                          const canDelete = isAdmin || b.employee_id === user?.id;
                          return (
                            <td key={p} className="p-1">
                              <div className="rounded-md p-2 min-h-[56px] bg-destructive/15 border border-destructive/30 text-center">
                                <div className="font-medium text-[11px] truncate" title={b.employee_name ?? ""}>{b.employee_name ?? "—"}</div>
                                {b.note && <div className="text-[10px] text-muted-foreground truncate">{b.note}</div>}
                                {canDelete && (
                                  <button onClick={() => { if (confirm("حذف؟")) del.mutate(b.id); }} className="text-destructive text-[10px] hover:underline mt-0.5">حذف</button>
                                )}
                              </div>
                            </td>
                          );
                        }
                        return (
                          <td key={p} className="p-1">
                            <div className="rounded-md p-2 min-h-[56px] bg-success/10 border border-success/20 text-center text-[11px] text-success/80">متاح</div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="list" className="space-y-2">
          {bookings.data?.map((r) => (
            <div key={r.id} className="glass rounded-xl p-4 flex flex-wrap items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
              <div className="flex-1 min-w-[200px]">
                <div className="font-semibold flex items-center gap-2">
                  {r.resource}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary">{r.period}</span>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2"><CalendarDays className="h-3 w-3" /> {r.booking_date} · {r.employee_name ?? "—"}</div>
                {r.note && <div className="text-xs text-muted-foreground mt-1">{r.note}</div>}
              </div>
              {(isAdmin || r.employee_id === user?.id) && (
                <Button size="sm" variant="ghost" onClick={() => { if (confirm("حذف هذا الحجز؟")) del.mutate(r.id); }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
          {bookings.data?.length === 0 && <div className="glass rounded-2xl p-10 text-center text-muted-foreground">لا توجد حجوزات</div>}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NewBookingDialog({ resources, periods, onSaved }: { resources: string[]; periods: number; onSaved: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [resource, setResource] = useState("");
  const [date, setDate] = useState("");
  const [period, setPeriod] = useState("");
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase.from("resource_bookings")
        .select("id").eq("resource", resource).eq("booking_date", date).eq("period", period).maybeSingle();
      if (existing) throw new Error("هذا المرفق محجوز في نفس الحصة");
      const { error } = await supabase.from("resource_bookings").insert({
        employee_id: user!.id, resource, booking_date: date, period, note: note || null, status: "approved",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الحجز"); setOpen(false); setResource(""); setDate(""); setPeriod(""); setNote(""); onSaved(); },
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
              <SelectContent>
                {resources.length === 0 && <div className="p-2 text-sm text-muted-foreground">لا توجد مرافق — أضفها من الإعدادات</div>}
                {resources.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>التاريخ</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label>الحصة</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>{Array.from({ length: periods }, (_, i) => i + 1).map((p) => <SelectItem key={p} value={`الحصة ${p}`}>الحصة {p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>ملاحظة (اختياري)</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="نشاط، صف..." /></div>
          <Button onClick={() => save.mutate()} disabled={!resource || !date || !period || save.isPending} className="w-full gradient-primary text-primary-foreground">
            {save.isPending ? "جاري..." : "تأكيد الحجز"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
