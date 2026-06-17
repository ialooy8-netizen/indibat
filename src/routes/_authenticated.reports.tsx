import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart3, Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(); monthStart.setDate(1);
  const [from, setFrom] = useState(monthStart.toISOString().slice(0, 10));
  const [to, setTo] = useState(today);

  const absences = useQuery({
    queryKey: ["report-absences", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("date, status, students(name, classes(name))")
        .eq("status", "absent")
        .gte("date", from).lte("date", to)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-3xl font-bold flex items-center gap-2"><BarChart3 className="h-7 w-7 text-primary" /> التقارير</h2>
        <Button onClick={() => window.print()} variant="outline" className="gap-2"><Printer className="h-4 w-4" /> طباعة</Button>
      </div>

      <div className="glass rounded-2xl p-4 flex flex-wrap gap-3">
        <div><Label>من</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>إلى</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-3">سجل الغياب ({absences.data?.length ?? 0})</h3>
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr><th className="p-3 text-right">التاريخ</th><th className="p-3 text-right">الطالب</th><th className="p-3 text-right">الصف</th></tr>
            </thead>
            <tbody>
              {absences.data?.map((r, i) => (
                <tr key={i} className="border-t border-border/30">
                  <td className="p-3">{r.date}</td>
                  <td className="p-3">{(r.students as { name: string } | null)?.name ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{((r.students as { classes: { name: string } | null } | null)?.classes)?.name ?? "—"}</td>
                </tr>
              ))}
              {absences.data?.length === 0 && <tr><td colSpan={3} className="p-10 text-center text-muted-foreground">لا يوجد غياب في هذه الفترة</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
