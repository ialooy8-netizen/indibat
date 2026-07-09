import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import { sendSms } from "@/lib/messaging.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Props = {
  phone: string;
  message: string;
  label?: string;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "ghost";
  className?: string;
};

/**
 * Small reusable "Send SMS" button. Opens a confirm dialog so the user can
 * tweak the message before it goes out through GatewayAPI / Twilio.
 */
export function SmsButton({ phone, message, label = "SMS", size = "sm", variant = "outline", className }: Props) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(normalize(phone));
  const [body, setBody] = useState(message);
  const fn = useServerFn(sendSms);
  const m = useMutation({
    mutationFn: async () => fn({ data: { to, message: body, provider: "auto" } }),
    onSuccess: (r) => { toast.success(`أُرسلت عبر ${r.provider === "gatewayapi" ? "GatewayAPI" : "Twilio"}`); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size} variant={variant} className={"gap-1 " + (className ?? "")}>
          <MessageSquare className="h-3.5 w-3.5" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>إرسال رسالة SMS</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>الرقم</Label>
            <Input value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" placeholder="+9733XXXXXXX" />
          </div>
          <div>
            <Label>الرسالة</Label>
            <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={480} />
            <p className="text-xs text-muted-foreground mt-1">{body.length}/480</p>
          </div>
          <Button className="w-full gradient-primary text-primary-foreground" disabled={!to || !body || m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? "جاري الإرسال..." : "إرسال"}
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">
            يتم الإرسال تلقائياً عبر GatewayAPI أو Twilio (أيهما مُتصل).
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function normalize(p: string): string {
  const d = p.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d;
  if (d.startsWith("00")) return "+" + d.slice(2);
  if (d.length === 8) return "+973" + d; // Bahrain default
  return "+" + d;
}
