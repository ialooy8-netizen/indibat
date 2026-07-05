import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranding } from "@/hooks/useBranding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { BarChart3, Printer, Download, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

function downloadCSV(filename: string, rows: (string | number | null | undefined)[][]) {
  const csv = "\uFEFF" + rows.map((r) => r.map((c) => {
    const v = String(c ?? "");
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function brandedPrint(title: string, headerUrl: string | undefined, subtitle: string, tableHtml: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${title}</title>
    <style>@page{size:A4;margin:14mm}body{font-family:'Segoe UI',Tahoma,sans-serif;color:#111;margin:0}
    header{border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:12px;display:flex;align-items:center;gap:12px}
    header img{max-height:64px}h1{margin:0;font-size:20px}.sub{color:#555;font-size:13px;margin-bottom:12px}
    table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:right}
    thead{background:#f0f0f0}footer{margin-top:20px;padding-top:8px;border-top:1px solid #ccc;color:#666;font-size:11px;text-align:center}</style>
    </head><body><header>${headerUrl ? `<img src="${headerUrl}"/>` : ""}<div><h1>${title}</h1><div class="sub">${subtitle}</div></div></header>
    ${tableHtml}<footer>EduPulse | نبض — تم التوليد بتاريخ ${new Date().toLocaleString("ar")}</footer></body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

function downloadCSV(filename: string, rows: (string | number | null | undefined)[][]) {
  const csv = "\uFEFF" + rows.map((r) => r.map((c) => {
    const v = String(c ?? "");
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function ReportsPage() {
  const branding = useBranding();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(); monthStart.setDate(1);
  const [from, setFrom] = useState(monthStart.toISOString().slice(0, 10));
  const [to, setTo] = useState(today);

  const absences = useQuery({
    queryKey: ["report-absences", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance")
        .select("date, status, students(name, classes(name))")
        .eq("status", "absent").gte("date", from).lte("date", to)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const incidents = useQuery({
    queryKey: ["report-incidents", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.from("behavior_incidents")
        .select("created_at, type, points, severity, note, students(name, classes(name))")
        .gte("created_at", from).lte("created_at", to + "T23:59:59")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const classSummary = useQuery({
    queryKey: ["report-classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("class_id, behavior_points, classes(name)");
      if (error) throw error;
      const map = new Map<string, { name: string; count: number; sum: number; risk: number }>();
      for (const s of data) {
        const cls = (s.classes as { name: string } | null)?.name ?? "بدون صف";
        const cur = map.get(cls) ?? { name: cls, count: 0, sum: 0, risk: 0 };
        cur.count++; cur.sum += s.behavior_points;
        if (s.behavior_points < 70) cur.risk++;
        map.set(cls, cur);
      }
      return Array.from(map.values()).sort((a, b) => b.count - a.count);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-3xl font-bold flex items-center gap-2"><BarChart3 className="h-7 w-7 text-primary" /> التقارير</h2>
        <Button onClick={() => window.print()} variant="outline" className="gap-2"><Printer className="h-4 w-4" /> طباعة</Button>
      </div>

      <div className="glass rounded-2xl p-4 flex flex-wrap gap-3 items-end">
        <div><Label>من</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>إلى</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>

      <Tabs defaultValue="absences">
        <TabsList className="grid grid-cols-3 w-full max-w-xl">
          <TabsTrigger value="absences">الغياب</TabsTrigger>
          <TabsTrigger value="incidents">السلوك</TabsTrigger>
          <TabsTrigger value="classes">ملخص الصفوف</TabsTrigger>
        </TabsList>

        <TabsContent value="absences" className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">سجل الغياب ({absences.data?.length ?? 0})</h3>
            <Button size="sm" variant="outline" onClick={() => downloadCSV(`absences-${from}-${to}.csv`, [
              ["التاريخ", "الطالب", "الصف"],
              ...(absences.data ?? []).map((r) => [
                r.date,
                (r.students as { name: string } | null)?.name ?? "",
                ((r.students as { classes: { name: string } | null } | null)?.classes)?.name ?? "",
              ]),
            ])} className="gap-2"><Download className="h-4 w-4" /> CSV</Button>
          </div>
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
                {absences.data?.length === 0 && <tr><td colSpan={3} className="p-10 text-center text-muted-foreground">لا يوجد غياب</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="incidents" className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">السجل السلوكي ({incidents.data?.length ?? 0})</h3>
            <Button size="sm" variant="outline" onClick={() => downloadCSV(`incidents-${from}-${to}.csv`, [
              ["التاريخ", "الطالب", "الصف", "النوع", "النقاط", "الشدة", "ملاحظة"],
              ...(incidents.data ?? []).map((r) => [
                new Date(r.created_at).toLocaleDateString("ar"),
                (r.students as { name: string } | null)?.name ?? "",
                ((r.students as { classes: { name: string } | null } | null)?.classes)?.name ?? "",
                r.type === "reward" ? "مكافأة" : "مخالفة",
                r.points,
                r.severity ?? "",
                r.note ?? "",
              ]),
            ])} className="gap-2"><Download className="h-4 w-4" /> CSV</Button>
          </div>
          <div className="glass rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr><th className="p-3 text-right">التاريخ</th><th className="p-3 text-right">الطالب</th><th className="p-3 text-right">النوع</th><th className="p-3 text-right">النقاط</th><th className="p-3 text-right">ملاحظة</th></tr>
              </thead>
              <tbody>
                {incidents.data?.map((r, i) => (
                  <tr key={i} className="border-t border-border/30">
                    <td className="p-3 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString("ar")}</td>
                    <td className="p-3">{(r.students as { name: string } | null)?.name ?? "—"}</td>
                    <td className="p-3"><span className={r.type === "reward" ? "text-success" : "text-destructive"}>{r.type === "reward" ? "مكافأة" : "مخالفة"}</span></td>
                    <td className="p-3 tabular-nums">{r.type === "reward" ? "+" : "-"}{r.points}</td>
                    <td className="p-3 text-muted-foreground text-xs">{r.note ?? "—"}</td>
                  </tr>
                ))}
                {incidents.data?.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">لا يوجد سجل</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="classes" className="space-y-3 mt-4">
          <h3 className="text-lg font-semibold">متوسط سلوك كل صف</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {classSummary.data?.map((c) => {
              const avg = c.count > 0 ? Math.round(c.sum / c.count) : 0;
              return (
                <div key={c.name} className="glass rounded-xl p-4">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="font-semibold">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.count} طالب</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-bold ${avg >= 80 ? "text-success" : avg >= 60 ? "text-warning" : "text-destructive"}`}>{avg}</span>
                    <span className="text-xs text-muted-foreground">متوسط نقاط السلوك</span>
                  </div>
                  {c.risk > 0 && <p className="text-xs text-destructive mt-1">{c.risk} طالب تحت خط الإنذار</p>}
                </div>
              );
            })}
            {classSummary.data?.length === 0 && <div className="col-span-full glass rounded-2xl p-10 text-center text-muted-foreground">لا توجد صفوف</div>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
