import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
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
import { CalendarCheck2, Plus, Printer, Check, X, RefreshCcw, Trash2, Paperclip, Upload, Loader2, Image as ImageIcon, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { submitEvent, reviewEvent } from "@/lib/events.functions";
import { FeatureHelp } from "@/components/app/FeatureHelp";
import { uploadAttachment, getAttachmentUrl } from "@/lib/storage";
import { OneDriveArchiveButton } from "@/components/app/OneDriveArchiveButton";

export const Route = createFileRoute("/_authenticated/events")({
  component: EventsPage,
});

type Attachment = { url: string; name: string; type?: string };

type EventRow = {
  id: string;
  teacher_id: string;
  event_name: string;
  description: string;
  event_date: string | null;
  category: string | null;
  target_audience: string | null;
  location: string | null;
  attachments: Attachment[];
  onedrive_url: string | null;
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

const CATEGORIES = ["أكاديمية", "رياضية", "ثقافية", "فنية", "اجتماعية", "دينية", "وطنية", "بيئية", "أخرى"];

function EventsPage() {
  const { user } = useAuth();
  const { isAdmin, isTeacher } = useRoles();
  const qc = useQueryClient();

  const rows = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("event_submissions").select("*").order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, attachments: (r.attachments as unknown as Attachment[]) ?? [] })) as EventRow[];
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

  async function buildPrintHtml(r: EventRow): Promise<string> {
    const teacher = names.data?.get(r.teacher_id)?.name ?? "—";
    const reviewer = r.reviewer_id ? names.data?.get(r.reviewer_id) : null;
    const signature = reviewer?.signature_url;
    const attHtml = r.attachments.length
      ? `<div class="section-title">المرفقات (${r.attachments.length})</div>
         <ul class="atts">${r.attachments.map((a) => `<li>${escapeHtml(a.name)}</li>`).join("")}</ul>`
      : "";
    return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>${r.event_name}</title>
      <style>
        @page { size: A4; margin: 18mm 15mm; }
        html,body { background:#fff; color:#111; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; line-height:1.9; }
        body { padding:0; margin:0; }
        .header { text-align:center; border-bottom:2px solid #2563eb; padding-bottom:10pt; margin-bottom:16pt; }
        .header img { max-height:80px; object-fit:contain; }
        .header .school { font-size:13pt; color:#333; margin-top:6pt; }
        h1 { font-size:20pt; margin:0 0 6pt; color:#0f172a; }
        .meta { color:#333; font-size:11pt; margin-bottom:14pt; border-bottom:1px dashed #cbd5e1; padding-bottom:6pt; }
        .meta div { margin:3pt 0; }
        .grid { display:grid; grid-template-columns:1fr 1fr; gap:4pt 20pt; }
        .section-title { font-size:14pt; color:#2563eb; margin-top:14pt; margin-bottom:6pt; font-weight:bold; }
        .body { font-size:13pt; white-space:pre-wrap; }
        .atts { font-size:11pt; padding-inline-start:20pt; }
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
        <div class="grid">
          <div><strong>اسم الفعالية:</strong> ${escapeHtml(r.event_name)}</div>
          <div><strong>الفئة:</strong> ${escapeHtml(r.category ?? "—")}</div>
          <div><strong>تاريخ الفعالية:</strong> ${r.event_date ? new Date(r.event_date).toLocaleDateString("ar-BH") : "—"}</div>
          <div><strong>المكان:</strong> ${escapeHtml(r.location ?? "—")}</div>
          <div><strong>الفئة المستهدفة:</strong> ${escapeHtml(r.target_audience ?? "—")}</div>
          <div><strong>مقدّم الطلب:</strong> ${escapeHtml(teacher)}</div>
          <div><strong>تاريخ التقديم:</strong> ${new Date(r.submitted_at).toLocaleDateString("ar-BH")}</div>
          <div><strong>تاريخ الاعتماد:</strong> ${r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString("ar-BH") : "—"}</div>
        </div>
      </div>
      <div class="section-title">وصف الفعالية والأهداف</div>
      <div class="body">${escapeHtml(r.description)}</div>
      ${attHtml}
      <div class="approval">
        <div class="section-title">اعتماد الإدارة</div>
        <div>الاسم: <strong>${escapeHtml(reviewer?.name ?? "—")}</strong></div>
        <div style="margin-top:8pt">التوقيع: <span class="sig-line">${signature ? `<img src="${signature}" />` : "&nbsp;"}</span></div>
        ${r.reviewer_note ? `<div style="margin-top:8pt"><strong>ملاحظة:</strong> ${escapeHtml(r.reviewer_note)}</div>` : ""}
      </div>
      <div class="footer">${escapeHtml(header.data?.footerNote ?? "")} · مُولّد بواسطة EduPulse | نبض · ${new Date().toLocaleDateString("ar-BH")}</div>
      </body></html>`;
  }

  async function printApproved(r: EventRow) {
    const html = await buildPrintHtml(r);
    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  async function getPdfBlob(r: EventRow): Promise<Blob> {
    const html = await buildPrintHtml(r);
    return new Blob([html], { type: "text/html;charset=utf-8" });
  }

  const canReview = isAdmin;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <CalendarCheck2 className="h-7 w-7 text-primary" /> توثيق الفعاليات
            <FeatureHelp title="توثيق الفعاليات">
              <p>المعلم يقدّم اسم الفعالية، الفئة، التاريخ، المكان، الفئة المستهدفة، الوصف، والمرفقات (صور/مستندات).</p>
              <p>المدير/المساعد يعتمد أو يطلب تعديلات. بعد الاعتماد تُطبع الوثيقة بترويسة المدرسة وتوقيع المعتمِد، ويمكن أرشفتها إلى OneDrive.</p>
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
          {pending.map((r) => <EventCard key={r.id} row={r} teacherName={names.data?.get(r.teacher_id)?.name ?? "—"} canReview canArchive={isAdmin} onPrint={printApproved} getPdfBlob={getPdfBlob} onDelete={() => del.mutate(r.id)} />)}
          {pending.length === 0 && <Empty text="لا توجد طلبات معلّقة" />}
        </TabsContent>}

        {canReview && <TabsContent value="all" className="space-y-2 mt-4">
          {others.map((r) => <EventCard key={r.id} row={r} teacherName={names.data?.get(r.teacher_id)?.name ?? "—"} canReview={r.status === "pending" || r.status === "needs_edits"} canArchive={isAdmin} onPrint={printApproved} getPdfBlob={getPdfBlob} onDelete={() => del.mutate(r.id)} />)}
          {others.length === 0 && <Empty text="لا توجد فعاليات بعد" />}
        </TabsContent>}

        {isTeacher && <TabsContent value="mine" className="space-y-2 mt-4">
          {mine.map((r) => <EventCard key={r.id} row={r} teacherName="أنا" canReview={false} canArchive={false} onPrint={printApproved} getPdfBlob={getPdfBlob} onDelete={() => del.mutate(r.id)} showResubmit={r.status === "needs_edits"} onSaved={() => qc.invalidateQueries({ queryKey: ["events"] })} />)}
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
  row, teacherName, canReview, canArchive, onPrint, getPdfBlob, onDelete, showResubmit, onSaved,
}: {
  row: EventRow;
  teacherName: string;
  canReview: boolean;
  canArchive: boolean;
  onPrint: (r: EventRow) => void;
  getPdfBlob: (r: EventRow) => Promise<Blob>;
  onDelete: () => void;
  showResubmit?: boolean;
  onSaved?: () => void;
}) {
  const st = STATUS_LABELS[row.status];
  void showResubmit; void onSaved;
  return (
    <div className="glass rounded-xl p-4 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{row.event_name}</div>
          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
            <span>{teacherName}</span>
            {row.category && <span>• {row.category}</span>}
            {row.event_date && <span>• {new Date(row.event_date).toLocaleDateString("ar-BH")}</span>}
            {row.location && <span>• {row.location}</span>}
          </div>
        </div>
        <span className={`text-xs font-bold px-3 py-1 rounded-full ${st.chip}`}>{st.label}</span>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">عرض التفاصيل</summary>
        <div className="mt-2 space-y-2">
          {row.target_audience && <p className="text-xs"><strong>الفئة المستهدفة:</strong> {row.target_audience}</p>}
          <p className="whitespace-pre-wrap">{row.description}</p>
          {row.attachments.length > 0 && <AttachmentsList atts={row.attachments} />}
        </div>
      </details>
      {row.reviewer_note && (
        <p className="text-xs text-warning bg-warning/10 rounded p-2">ملاحظة المراجع: {row.reviewer_note}</p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        {canReview && <ReviewButtons id={row.id} />}
        {row.status === "approved" && <Button size="sm" variant="outline" className="gap-1" onClick={() => onPrint(row)}><Printer className="h-3.5 w-3.5" /> طباعة الوثيقة</Button>}
        {row.status === "approved" && canArchive && !row.onedrive_url && (
          <OneDriveArchiveButton
            folder="events"
            filename={`${row.event_name.replace(/[^\p{L}\p{N}_-]+/gu, "_")}.html`}
            getBlob={() => getPdfBlob(row)}
          />
        )}
        {row.onedrive_url && (
          <a href={row.onedrive_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-success/15 text-success">
            <ExternalLink className="h-3 w-3" /> على OneDrive
          </a>
        )}
        {showResubmit && onSaved && <ResubmitDialog row={row} onSaved={onSaved} />}
        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => confirm("حذف؟") && onDelete()}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

function AttachmentsList({ atts }: { atts: Attachment[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  async function open(path: string) {
    if (urls[path]) { window.open(urls[path], "_blank"); return; }
    try {
      const u = await getAttachmentUrl(path);
      setUrls((p) => ({ ...p, [path]: u }));
      window.open(u, "_blank");
    } catch (e) { toast.error((e as Error).message); }
  }
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {atts.map((a) => (
        <button key={a.url} type="button" onClick={() => open(a.url)} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-secondary hover:bg-secondary/70">
          {a.type?.startsWith("image/") ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
          {a.name}
        </button>
      ))}
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

type SubmitInitial = {
  id: string; event_name: string; description: string;
  event_date: string | null; category: string | null;
  target_audience: string | null; location: string | null;
  attachments: Attachment[];
};

function SubmitDialog({ onSaved, initial, buttonLabel }: { onSaved: () => void; initial?: SubmitInitial; buttonLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.event_name ?? "");
  const [desc, setDesc] = useState(initial?.description ?? "");
  const [date, setDate] = useState(initial?.event_date ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [audience, setAudience] = useState(initial?.target_audience ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [atts, setAtts] = useState<Attachment[]>(initial?.attachments ?? []);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const fn = useServerFn(submitEvent);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: Attachment[] = [];
      for (const f of Array.from(files)) {
        if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name} أكبر من 10MB`); continue; }
        const path = await uploadAttachment(f, "events");
        uploaded.push({ url: path, name: f.name, type: f.type });
      }
      setAtts((p) => [...p, ...uploaded]);
      if (uploaded.length) toast.success(`تم رفع ${uploaded.length} ملف`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  const m = useMutation({
    mutationFn: async () => {
      await fn({ data: {
        id: initial?.id,
        event_name: name,
        description: desc,
        event_date: date || null,
        category: category || null,
        target_audience: audience || null,
        location: location || null,
        attachments: atts,
      }});
    },
    onSuccess: () => {
      toast.success(initial ? "تم إعادة الإرسال" : "تم الإرسال للاعتماد");
      setOpen(false);
      if (!initial) { setName(""); setDesc(""); setDate(""); setCategory(""); setAudience(""); setLocation(""); setAtts([]); }
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 gradient-primary text-primary-foreground"><Plus className="h-4 w-4" /> {buttonLabel ?? "توثيق فعالية جديدة"}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "إعادة إرسال بعد التعديل" : "توثيق فعالية"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2"><Label>اسم الفعالية *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اليوم الرياضي 2026" /></div>
            <div>
              <Label>الفئة</Label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                <option value="">— اختر —</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><Label>تاريخ الفعالية</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><Label>المكان</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="الملعب / الصالة / القاعة" /></div>
            <div><Label>الفئة المستهدفة</Label><Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="طلاب الصف السادس" /></div>
          </div>
          <div><Label>وصف الفعالية والأهداف *</Label><Textarea rows={7} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="اكتب الأهداف، الأنشطة، النتائج المرجوة..." /></div>

          <div>
            <Label className="flex items-center gap-2"><Paperclip className="h-4 w-4" /> المرفقات (صور، PDF، مستندات — حتى 10MB لكل ملف)</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploading ? "جارٍ الرفع..." : "إضافة ملفات"}
              </Button>
              {atts.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-secondary">
                  {a.type?.startsWith("image/") ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                  {a.name}
                  <button type="button" onClick={() => setAtts((p) => p.filter((_, j) => j !== i))} className="text-destructive ms-1"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          </div>

          <Button onClick={() => m.mutate()} disabled={name.length < 2 || desc.length < 10 || m.isPending || uploading} className="w-full gradient-primary text-primary-foreground">
            {m.isPending ? "..." : "إرسال للاعتماد"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResubmitDialog({ row, onSaved }: { row: EventRow; onSaved: () => void }) {
  return <SubmitDialog onSaved={onSaved} initial={{
    id: row.id,
    event_name: row.event_name,
    description: row.description,
    event_date: row.event_date,
    category: row.category,
    target_audience: row.target_audience,
    location: row.location,
    attachments: row.attachments,
  }} buttonLabel="تعديل وإعادة إرسال" />;
}
