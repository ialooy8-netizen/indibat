import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, HelpCircle, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { FeatureHelp } from "@/components/app/FeatureHelp";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
});

type Msg = {
  id: string;
  author_id: string;
  body: string;
  kind: "message" | "question";
  created_at: string;
};

type ProfileMini = { id: string; full_name: string | null };

function ChatPage() {
  const { user } = useAuth();
  const { isAdmin } = useRoles();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"message" | "question">("message");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const list = useQuery({
    queryKey: ["chat-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages").select("id, author_id, body, kind, created_at")
        .order("created_at", { ascending: true }).limit(500);
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((m) => m.author_id)));
      const profiles = ids.length
        ? (await supabase.from("profiles").select("id, full_name").in("id", ids)).data ?? []
        : [];
      const map = new Map<string, ProfileMini>((profiles as ProfileMini[]).map((p) => [p.id, p]));
      return ((data ?? []) as Msg[]).map((m) => ({ ...m, author_name: map.get(m.author_id)?.full_name ?? "زميل" }));
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("chat-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["chat-messages"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [list.data?.length]);

  const send = useMutation({
    mutationFn: async () => {
      if (!user || !body.trim()) return;
      const { error } = await supabase.from("chat_messages").insert({ author_id: user.id, body: body.trim(), kind });
      if (error) throw error;
    },
    onSuccess: () => { setBody(""); setKind("message"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chat_messages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-messages"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-3xl font-bold flex items-center gap-2">
          <MessageSquare className="h-7 w-7 text-primary" /> غرفة موظفي المدرسة
        </h2>
        <FeatureHelp title="غرفة الموظفين">
          <p>غرفة تواصل خاصة بجميع الموظفين. يمكنك إرسال رسالة عادية أو إرسال <b>سؤال</b> ليظهر بلون مختلف حتى ينتبه الزملاء.</p>
          <p>يمكن للمالك ضبط سياسة الاحتفاظ بالرسائل (تلقائي كل 24 ساعة أو يدوي).</p>
        </FeatureHelp>
      </div>

      <div className="glass rounded-2xl p-4 h-[60vh] overflow-y-auto space-y-2">
        {list.isPending && <p className="text-sm text-muted-foreground text-center py-6">جاري التحميل...</p>}
        {!list.isPending && (list.data?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">لا توجد رسائل بعد. كن أول من يكتب!</p>
        )}
        {list.data?.map((m) => {
          const mine = m.author_id === user?.id;
          const isQ = m.kind === "question";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 border ${
                isQ ? "bg-accent/15 border-accent/50" : mine ? "bg-primary/15 border-primary/40" : "bg-card border-border/40"
              }`}>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-0.5">
                  <span className="font-semibold text-foreground">{m.author_name}</span>
                  {isQ && <span className="inline-flex items-center gap-1 text-accent font-bold"><HelpCircle className="h-3 w-3" /> سؤال</span>}
                  <span>·</span>
                  <span>{new Date(m.created_at).toLocaleString("ar-BH", { dateStyle: "short", timeStyle: "short" })}</span>
                  {(mine || isAdmin) && (
                    <button onClick={() => del.mutate(m.id)} className="mr-auto text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="text-sm whitespace-pre-wrap">{m.body}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="glass rounded-2xl p-3 space-y-2">
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={kind === "message" ? "default" : "outline"} onClick={() => setKind("message")}>رسالة</Button>
          <Button type="button" size="sm" variant={kind === "question" ? "default" : "outline"} onClick={() => setKind("question")}
            className={kind === "question" ? "bg-accent text-accent-foreground" : ""}>
            <HelpCircle className="h-3.5 w-3.5 ml-1" /> سؤال
          </Button>
        </div>
        <div className="flex gap-2 items-end">
          <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="اكتب رسالتك..." className="flex-1" />
          <Button onClick={() => send.mutate()} disabled={!body.trim() || send.isPending} className="gap-1 gradient-primary text-primary-foreground">
            <Send className="h-4 w-4" /> إرسال
          </Button>
        </div>
      </div>
    </div>
  );
}
