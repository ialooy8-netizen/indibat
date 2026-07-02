import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info, Mail, Phone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranding } from "@/hooks/useBranding";
import { useAppName } from "@/hooks/useAppName";

type About = { body: string; email: string; phone?: string };

export function AboutDialog({ variant = "ghost", size = "sm", className }: { variant?: "ghost" | "outline" | "default"; size?: "sm" | "default"; className?: string }) {
  const { homeLogoUrl } = useBranding();
  const app = useAppName();
  const about = useQuery({
    queryKey: ["about-text"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "about").maybeSingle();
      return (data?.value as About) ?? { body: "", email: "ali.y.hassan@moe.bh" };
    },
  });
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={`gap-1 ${className ?? ""}`}>
          <Info className="h-4 w-4" /> عن النظام
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center">
            <img src={homeLogoUrl} alt={app.name} className="mx-auto h-24 object-contain mb-2" />
            <span className="text-gradient text-2xl">{app.name}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm leading-relaxed text-foreground/90 text-right">
          <p className="whitespace-pre-wrap">{about.data?.body ?? ""}</p>
          <div className="glass rounded-xl p-4 space-y-2">
            {about.data?.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-primary shrink-0" />
                <div><div className="text-xs text-muted-foreground">للتواصل:</div>
                <a href={`mailto:${about.data.email}`} className="text-primary hover:underline" dir="ltr">{about.data.email}</a></div>
              </div>
            )}
            {about.data?.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-primary shrink-0" />
                <a href={`tel:${about.data.phone}`} className="text-primary hover:underline" dir="ltr">{about.data.phone}</a>
              </div>
            )}
          </div>
          <p className="text-center italic text-accent font-semibold pt-2">{app.tagline}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
