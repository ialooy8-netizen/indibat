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
import { Megaphone, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/circulars")({
  component: CircularsPage,
});

function CircularsPage() {
  const { isAdmin } = useRoles();
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["circulars"],
    queryFn: async () => {
      const { data, error } = await supabase.from("circulars").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("circulars").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["circulars"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-3xl font-bold flex items-center gap-2"><Megaphone className="h-7 w-7 text-primary" /> التعاميم</h2>
        {isAdmin && <NewCircular onSaved={() => qc.invalidateQueries({ queryKey: ["circulars"] })} />}
      </div>

      <div className="space-y-3">
        {list.data?.map((c) => (
          <div key={c.id} className="glass rounded-xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="font-semibold">{c.title}</h3>
                {c.body && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{c.body}</p>}
                <p className="text-xs text-muted-foreground mt-2">{new Date(c.created_at).toLocaleDateString("ar")}</p>
              </div>
              {isAdmin && <Button size="sm" variant="ghost" onClick={() => del.mutate(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
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
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("circulars").insert({ title, body, posted_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم النشر"); setOpen(false); setTitle(""); setBody(""); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="gap-2 gradient-primary text-primary-foreground"><Plus className="h-4 w-4" /> تعميم جديد</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>تعميم جديد</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>العنوان</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>المحتوى</Label><Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} /></div>
          <Button onClick={() => save.mutate()} disabled={!title || save.isPending} className="w-full gradient-primary text-primary-foreground">نشر</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
