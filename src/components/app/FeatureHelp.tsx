import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = { title: string; children: React.ReactNode; size?: "sm" | "md" };

export function FeatureHelp({ title, children, size = "md" }: Props) {
  const [open, setOpen] = useState(false);
  const dim = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="ما هذه الميزة؟"
        aria-label="ما هذه الميزة؟"
        className="inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 p-1 transition"
      >
        <HelpCircle className={dim} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" /> {title}
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground leading-7 space-y-2">{children}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}
