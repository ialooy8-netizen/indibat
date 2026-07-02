import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CalendarCheck2, Plus, Printer, Check, X, RefreshCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { submitEvent, reviewEvent } from "@/lib/events.functions";
import { FeatureHelp } from "@/components/app/FeatureHelp";

export const Route = createFileRoute("/_authenticated/events")({
  component: EventsPage,
});

type EventRow = {
  id: string;
  teacher_id: string;
  event_name: string;
  description: string;
  status: "pending" | "approved" | "rejected" | "needs_edits";
  reviewer_id: string | null;
  reviewer_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
};

const STATUS_LABELS: Record<EventRow["status"], { label: string; chip: string }> = {
  pending: { label: "قيد المراجعة", chip: "bg-warning/20 text-warning" },
  needs_edits: { label: "تعديلات مطلوبة", chip: "bg-warning/20 text-warning" },
  approved: { label: "معتمدة", chip: "bg-success/20 text-success" },
  rejected: { label: "مرفوضة", chip: "bg-destructive/20 text-destructive" },
};

function EventsPage() {
  const { user } = useAuth();
  const { isAdmin, isTeacher } = useRoles();
  const qc = useQueryClient();

  const rows = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("event_submissions").select("*").order("submitted_at", { ascending: false });
      if (error) throw error;
      return data as EventRow[];
    },
  });

  const teacherIds = Array.from(new Set(rows.data?.map((r) => r.teacher_id) ?? []));
  const reviewerIds = Array.from(new Set((rows.data ?? []).map((r) => r.reviewer_id).filter(Boolean) as string[]));
  const allIds = Array.from(new Set([...teacherIds, ...reviewerIds]));
  const names = useQuery({
    queryKey: ["profile-names", allIds],
    enabled: allIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, signature_url").in("id", allIds);
      const map = new Map<string, { name: string | null; signature_url: string | null }>();
      for (const p of data ?? []) map.set(p.id, { name: p.full_name, signature_url: p.signature_url });
      return map;
    },
  });

  const header = useQuery({
    queryKey: ["school-header"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "school_header").maybeSingle();
      return (data?.value as { headerUrl: string | null; schoolName: string; footerNote: string }) ?? { headerUrl: null, schoolName: "", footerNote: "" };
    },
  });

  const mine = rows.data?.filter((r) => r.teacher_id === user?.id) ?? [];
  const pending = rows.data?.filter((r) => r.status === "pending") ?? [];
  const others = rows.data ?? [];

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("event_submissions").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["events"] }); },
  });

  function printApproved(r: EventRow) {
    const teacher = names.data?.get(r.teacher_id)?.name ?? "—";
    const reviewer = r.reviewer_id ? names.data?.get(r.reviewer_id) : null;
    const signature = reviewer?.signature_url;
    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) return;
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>${r.event_name}</title>
      <style>
        @page { size: A4; margin: 18mm 15mm; }
        html,body { background:#fff; color:#111; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; line-height:1.9; }
        body { padding:0; margin:0; }
        .header { text-align:center; border-bottom:2px solid #2563eb; padding-bottom:10pt; margin-bottom:16pt; }
        .header img { max-height:80px; object-fit:contain; }
        .header .school { font-size:13pt; color:#333; margin-top:6pt; }
        h1 { font-size:20pt; margin:0 0 6pt; color:#0f172a; }
        .meta { color:#555; font-size:11pt; margin-bottom:14pt; border-bottom:1px dashed #cbd5e1; padding-bottom:6pt; }
        .section-title { font-size:14pt; color:#2563eb; margin-top:14pt; margin-bottom:6pt; font-weight:bold; }
        .body { font-size:13pt; white-space:pre-wrap; }
        .approval { margin-top:26pt; padding-top:14pt; border-top:2px solid #16a34a; }
        .sig-line { display:inline-block; min-width:220px; border-bottom:1px solid #333; height:70px; text-align:center; vertical-align:bottom; padding-bottom:4pt; }
        .sig-line img { max-height:60px; }
        .footer { position:fixed; bottom:8mm; left:0; right:0; text-align:center; font-size:9pt; color:#888; }
      </style></head><body>
      <div class="header">
        ${header.data?.headerUrl ? `<img src="${header.data.headerUrl}" alt="School" />` : ""}
        ${header.data?.schoolName ? `<div class="school">${header.data.schoolName}</div>` : ""}
      </div>
      <h1>توثيق فعالية مدرسية</h1>
      <div class="meta">
        <div><strong>اسم الفعالية:</strong> ${r.event_name}</div>
        <div><strong>مقدّم الطلب:</strong> ${teacher}</div>
        <div><strong>تاريخ التقديم:</strong> ${new Date(r.submitted_at).toLocaleDateString("ar-BH")}</div>
        <div><strong>تاريخ الاعتماد:</strong> ${r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString("ar-BH") : "—"}</div>
      </div>
      <div class="section-title">وصف الفعالية والأهداف</div>
      <div class="body">${escapeHtml(r.description)}</div>
      <div class="approval">
        <div class="section-title">اعتماد الإدارة</div>
        <div>الاسم: <strong>${reviewer?.name ?? "—"}</strong></div>
        <div style="margin-top:8pt">التوقيع: <span class="sig-line">${signature ? `<img src="${signature}" />` : "&nbsp;"}</span></div>
      </div>
      <div class="footer">${header.data?.footerNote ?? ""} · مُولّد بواسطة EduPulse | نبض · ${new Date().toLocaleDateString("ar-BH")}</div>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  const canReview = isAdmin;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <CalendarCheck2 className="h-7 w-7 text-primary" /> توثيق الفعاليات
            <FeatureHelp title="توثيق الفعاليات">
              <p>المعلم يقدم اسم الفعالية ووصفها والأهداف. المدير/المساعد يعتمد أو يطلب تعديلات.</p>
              <p>بعد الاعتماد، يمكن طباعة الوثيقة بترويسة المدرسة وتوقيع المعتمِد كسجل رسمي.</p>
            </FeatureHelp>
          </h2>
        </div>
        {isTeacher && <SubmitDialog onSaved={() => qc.invalidateQueries({ queryKey: ["events"] })} />}
      </div>

      <Tabs defaultValue={canReview ? "queue" : "mine"}>
        <TabsList>
          {canReview && <TabsTrigger value="queue">قيد المراجعة ({pending.length})</TabsTrigger>}
          {canReview && <TabsTrigger value="all">الكل ({others.length})</TabsTrigger>}
          {isTeacher && <TabsTrigger value="mine">فعالياتي ({mine.length})</TabsTrigger>}
        </TabsList>

        {canReview && <TabsContent value="queue" className="space-y-2 mt-4">
          {pending.map((r) => <EventCard key={r.id} row={r} teacherName={names.data?.get(r.teacher_id)?.name ?? "—"} canReview onPrint={printApproved} onDelete={() => del.mutate(r.id)} />)}
          {pending.length === 0 && <Empty text="لا توجد طلبات معلّقة" />}
        </TabsContent>}

        {canReview && <TabsContent value="all" className="space-y-2 mt-4">
          {others.map((r) => <EventCard key={r.id} row={r} teacherName={names.data?.get(r.teacher_id)?.name ?? "—"} canReview={r.status === "pending" || r.status === "needs_edits"} onPrint={printApproved} onDelete={() => del.mutate(r.id)} />)}
          {others.length === 0 && <Empty text="لا توجد فعاليات بعد" />}
        </TabsContent>}

        {isTeacher && <TabsContent value="mine" className="space-y-2 mt-4">
          {mine.map((r) => <EventCard key={r.id} row={r} teacherName="أنا" canReview={false} onPrint={printApproved} onDelete={() => del.mutate(r.id)} showResubmit={r.status === "needs_edits"} onSaved={() => qc.invalidateQueries({ queryKey: ["events"] })} />)}
          {mine.length === 0 && <Empty text="لم تقدّم فعاليات بعد" />}
        </TabsContent>}
      </Tabs>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function Empty({ text }: { text: string }) {
  return <div className="glass rounded-2xl p-10 text-center text-muted-foreground">{text}</div>;
}

function EventCard({
  row, teacherName, canReview, onPrint, onDelete, showResubmit, onSaved,
}: {
  row: EventRow;
  teacherName: string;
  canReview: boolean;
  onPrint: (r: EventRow) => void;
  onDelete: () => void;
  showResubmit?: boolean;
  onSaved?: () => void;
}) {
  const st = STATUS_LABELS[row.status];
  return (
    <div className="glass rounded-xl p-4 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{row.event_name}</div>
          <div className="text-xs text-muted-foreground">{teacherName} · {new Date(row.submitted_at).toLocaleDateString("ar-BH")}</div>
        </div>
        <span className={`text-xs font-bold px-3 py-1 rounded-full ${st.chip}`}>{st.label}</span>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">عرض الوصف</summary>
        <p className="mt-2 whitespace-pre-wrap">{row.description}</p>
      </details>
      {row.reviewer_note && (
        <p className="text-xs text-warning bg-warning/10 rounded p-2">ملاحظة المراجع: {row.reviewer_note}</p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        {canReview && <ReviewButtons id={row.id} />}
        {row.status === "approved" && <Button size="sm" variant="outline" className="gap-1" onClick={() => onPrint(row)}><Printer className="h-3.5 w-3.5" /> طباعة الوثيقة</Button>}
        {showResubmit && onSaved && <ResubmitDialog row={row} onSaved={onSaved} />}
        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => confirm("حذف؟") && onDelete()}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

function ReviewButtons({ id }: { id: string }) {
  const qc = useQueryClient();
  const fn = useServerFn(reviewEvent);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState<null | "reject" | "edits">(null);
  const act = useMutation({
    mutationFn: async (action: "approved" | "rejected" | "needs_edits") => { await fn({ data: { id, action, note: note || undefined } }); },
    onSuccess: () => { toast.success("تم"); qc.invalidateQueries({ queryKey: ["events"] }); setOpen(null); setNote(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <>
      <Button size="sm" onClick={() => act.mutate("approved")} disabled={act.isPending} className="gap-1 bg-success text-success-foreground"><Check className="h-3.5 w-3.5" /> اعتماد</Button>
      <Button size="sm" variant="outline" className="gap-1" onClick={() => setOpen("edits")}><RefreshCcw className="h-3.5 w-3.5" /> طلب تعديلات</Button>
      <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => setOpen("reject")}><X className="h-3.5 w-3.5" /> رفض</Button>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{open === "edits" ? "اطلب تعديلات" : "سبب الرفض"}</DialogTitle></DialogHeader>
          <Textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="اكتب ملاحظتك للمعلم..." />
          <Button className="gradient-primary text-primary-foreground" onClick={() => act.mutate(open === "edits" ? "needs_edits" : "rejected")} disabled={!note || act.isPending}>إرسال</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SubmitDialog({ onSaved, initial, buttonLabel }: { onSaved: () => void; initial?: { id: string; event_name: string; description: string }; buttonLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.event_name ?? "");
  const [desc, setDesc] = useState(initial?.description ?? "");
  const fn = useServerFn(submitEvent);
  const m = useMutation({
    mutationFn: async () => { await fn({ data: { id: initial?.id, event_name: name, description: desc } }); },
    onSuccess: () => { toast.success(initial ? "تم إعادة الإرسال" : "تم الإرسال للاعتماد"); setOpen(false); if (!initial) { setName(""); setDesc(""); } onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 gradient-primary text-primary-foreground"><Plus className="h-4 w-4" /> {buttonLabel ?? "توثيق فعالية جديدة"}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{initial ? "إعادة إرسال بعد التعديل" : "توثيق فعالية"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>اسم الفعالية</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اليوم الرياضي 2026" /></div>
          <div><Label>وصف الفعالية والأهداف</Label><Textarea rows={8} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="اكتب الأهداف، الفئة المستهدفة، الأنشطة، النتائج المرجوة..." /></div>
          <Button onClick={() => m.mutate()} disabled={name.length < 2 || desc.length < 10 || m.isPending} className="w-full gradient-primary text-primary-foreground">
            {m.isPending ? "..." : "إرسال للاعتماد"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResubmitDialog({ row, onSaved }: { row: EventRow; onSaved: () => void }) {
  return <SubmitDialog onSaved={onSaved} initial={row} buttonLabel="تعديل وإعادة إرسال" />;
}
