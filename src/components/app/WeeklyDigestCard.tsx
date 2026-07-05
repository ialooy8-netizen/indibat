import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, Printer } from "lucide-react";
import { generateWeeklyDigest } from "@/lib/digest.functions";
import { toast } from "sonner";

export function WeeklyDigestCard() {
  const run = useServerFn(generateWeeklyDigest);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ text: string; from: string; to: string; avgBehavior: number; totalStudents: number } | null>(null);

  const go = async () => {
    setLoading(true);
    try {
      const r = await run();
      setData(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل توليد الملخص");
    } finally {
      setLoading(false);
    }
  };

  const doPrint = () => {
    if (!data) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>الملخص الأسبوعي</title>
      <style>@page{size:A4;margin:18mm}body{font-family:'Segoe UI',Tahoma,sans-serif;line-height:1.8;color:#111}h1{border-bottom:2px solid #333;padding-bottom:8px}.meta{color:#666;font-size:14px;margin-bottom:16px}pre{white-space:pre-wrap;font-family:inherit;font-size:15px}</style>
      </head><body><h1>ملخص الأسبوع — EduPulse | نبض</h1>
      <div class="meta">الفترة: ${data.from} إلى ${data.to} • عدد الطلاب: ${data.totalStudents} • متوسط السلوك: ${data.avgBehavior}</div>
      <pre>${data.text.replace(/</g, "&lt;")}</pre></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> الملخص الأسبوعي بالذكاء الاصطناعي
        </h3>
        <div className="flex gap-2">
          {data && <Button size="sm" variant="outline" onClick={doPrint} className="gap-2"><Printer className="h-4 w-4" /> طباعة</Button>}
          <Button size="sm" onClick={go} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {data ? "تحديث" : "توليد الملخص"}
          </Button>
        </div>
      </div>
      {!data && !loading && (
        <p className="text-sm text-muted-foreground">اضغط "توليد الملخص" لتحليل بيانات الأسبوع الماضي (غياب، سلوك، صفوف مقلقة) واقتراح توصيات.</p>
      )}
      {loading && <div className="text-sm text-muted-foreground animate-pulse">جاري تحليل بيانات الأسبوع…</div>}
      {data && (
        <div>
          <div className="text-xs text-muted-foreground mb-2">{data.from} → {data.to} • {data.totalStudents} طالب • متوسط السلوك {data.avgBehavior}</div>
          <pre className="whitespace-pre-wrap text-sm leading-7 font-sans">{data.text}</pre>
        </div>
      )}
    </div>
  );
}
