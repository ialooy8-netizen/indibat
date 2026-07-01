import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Megaphone, Plus, Trash2, Paperclip, FileDown, Pin, Clock } from "lucide-react";
import { toast } from "sonner";
import { uploadAttachment, getAttachmentUrl, deleteAttachment } from "@/lib/storage";
import { FeatureHelp } from "@/components/app/FeatureHelp";

export const Route = createFileRoute("/_authenticated/circulars")({
  component: CircularsPage,
});

function CircularsPage() {
  const { isAdmin } = useRoles();
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["circulars"],
    queryFn: async () => {
      const { data, error } = await supabase.from("circulars").select("*")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const del = useMutation({
    mutationFn: async (c: { id: string; attachment_path: string | null }) => {
      if (c.attachment_path) await deleteAttachment(c.attachment_path);
      const { error } = await supabase.from("circulars").delete().eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["circulars"] }),
  });

  async function openAttachment(path: string) {
    try {
      const url = await getAttachmentUrl(path);
      window.open(url, "_blank");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-3xl font-bold flex items-center gap-2">
          <Megaphone className="h-7 w-7 text-primary" /> التعاميم
          <FeatureHelp title="التعاميم">
            <p>يمكنك نشر تعميم لجميع الموظفين بأحد نوعين:</p>
            <p>• <b>مثبّت</b> — يظل ظاهراً في أعلى كل الصفحات حتى تحذفه يدوياً.</p>
            <p>• <b>عام</b> — يُحذف تلقائياً بعد 24 ساعة من نشره.</p>
          </FeatureHelp>
        </h2>
        {isAdmin && <NewCircular onSaved={() => qc.invalidateQueries({ queryKey: ["circulars"] })} />}
      </div>

      <div className="space-y-3">
        {list.data?.map((c) => (
          <div key={c.id} className={`glass rounded-xl p-4 ${c.pinned ? "border-r-4 border-accent" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="font-semibold flex items-center gap-2">
                  {c.pinned && <span title="مثبّت" className="text-accent"><Pin className="h-4 w-4" /></span>}
                  {c.title}
                  {c.pinned
                    ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent">مثبّت</span>
                    : c.expires_at && <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/20 text-warning inline-flex items-center gap-1"><Clock className="h-3 w-3" /> ينتهي {new Date(c.expires_at).toLocaleString("ar-BH", { dateStyle: "short", timeStyle: "short" })}</span>}
                </h3>
                {c.body && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{c.body}</p>}
                {c.attachment_path && (
                  <button onClick={() => openAttachment(c.attachment_path!)} className="mt-2 text-primary hover:underline text-sm inline-flex items-center gap-1">
                    <FileDown className="h-4 w-4" /> عرض المرفق
                  </button>
                )}
                <p className="text-xs text-muted-foreground mt-2">{new Date(c.created_at).toLocaleDateString("ar")}</p>
              </div>
              {isAdmin && <Button size="sm" variant="ghost" onClick={() => del.mutate({ id: c.id, attachment_path: c.attachment_path })}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
            </div>
          </div>
        ))}
        {list.data?.length === 0 && <div className="glass rounded-2xl p-10 text-center text-muted-foreground">لا توجد تعاميم</div>}
      </div>
    </div>
  );
}

function NewCircular({ onSaved }: { onSaved: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"pinned" | "general">("general");
  const save = useMutation({
    mutationFn: async () => {
      let attachment_path: string | null = null;
      if (file) attachment_path = await uploadAttachment(file, "circulars");
      const expires_at = mode === "general" ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;
      const { error } = await supabase.from("circulars").insert({
        title, body, posted_by: user?.id, attachment_path,
        pinned: mode === "pinned",
        expires_at,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم النشر"); setOpen(false); setTitle(""); setBody(""); setFile(null); setMode("general"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="gap-2 gradient-primary text-primary-foreground"><Plus className="h-4 w-4" /> تعميم جديد</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>تعميم جديد</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>نوع التعميم</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button type="button" onClick={() => setMode("pinned")}
                className={`rounded-xl border p-3 text-right text-sm transition ${mode === "pinned" ? "border-accent bg-accent/10" : "border-border/40 hover:bg-white/5"}`}>
                <div className="font-bold flex items-center gap-1"><Pin className="h-3.5 w-3.5" /> مثبّت</div>
                <div className="text-[11px] text-muted-foreground">يبقى ظاهراً حتى تحذفه يدوياً</div>
              </button>
              <button type="button" onClick={() => setMode("general")}
                className={`rounded-xl border p-3 text-right text-sm transition ${mode === "general" ? "border-primary bg-primary/10" : "border-border/40 hover:bg-white/5"}`}>
                <div className="font-bold flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> عام (24 ساعة)</div>
                <div className="text-[11px] text-muted-foreground">يُحذف تلقائياً بعد يوم</div>
              </button>
            </div>
          </div>
          <div><Label>العنوان</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>المحتوى</Label><Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} /></div>
          <div>
            <Label className="flex items-center gap-1"><Paperclip className="h-4 w-4" /> مرفق (اختياري)</Label>
            <Input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file && <p className="text-xs text-muted-foreground mt-1 truncate">{file.name}</p>}
          </div>
          <Button onClick={() => save.mutate()} disabled={!title || save.isPending} className="w-full gradient-primary text-primary-foreground">
            {save.isPending ? "جاري الرفع..." : "نشر"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

