import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";

export function StudentQRBadge({ studentId, studentName, className }: { studentId: string; studentName: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    const payload = `student:${studentId}`;
    QRCode.toCanvas(canvasRef.current, payload, { width: 260, margin: 2, color: { dark: "#0a0a0a", light: "#ffffff" } });
    QRCode.toDataURL(payload, { width: 512, margin: 2 }).then(setDataUrl);
  }, [studentId]);

  const doPrint = () => {
    const w = window.open("", "_blank");
    if (!w || !dataUrl) return;
    w.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>QR - ${studentName}</title>
      <style>@page{size:A6;margin:8mm}body{font-family:'Segoe UI',Tahoma,sans-serif;text-align:center;margin:0;padding:12px}h2{margin:8px 0 4px;font-size:20px}p{margin:2px 0;color:#555;font-size:14px}img{width:100%;max-width:260px}</style>
      </head><body><h2>${studentName}</h2>${className ? `<p>${className}</p>` : ""}<img src="${dataUrl}"/><p style="margin-top:8px">EduPulse | نبض</p></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl; a.download = `qr-${studentName}.png`; a.click();
  };

  return (
    <div className="glass rounded-xl p-4 flex flex-col items-center gap-3">
      <canvas ref={canvasRef} className="rounded-lg bg-white p-2" />
      <p className="text-xs text-muted-foreground text-center">امسح هذا الرمز من صفحة الحضور عبر QR لتسجيل الحضور فوراً.</p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={doPrint} className="gap-2"><Printer className="h-4 w-4" /> طباعة</Button>
        <Button size="sm" variant="outline" onClick={download} className="gap-2"><Download className="h-4 w-4" /> تحميل</Button>
      </div>
    </div>
  );
}
