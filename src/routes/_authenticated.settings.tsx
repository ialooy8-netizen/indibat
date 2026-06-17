import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/useRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { isMaster, loading } = useRoles();
  const qc = useQueryClient();
  const cfg = useQuery({
    queryKey: ["facility-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("facility_config").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [periods, setPeriods] = useState(7);
  const [workingDays, setWorkingDays] = useState("");
  const [resources, setResources] = useState("");

  useEffect(() => {
    if (cfg.data) {
      setPeriods(cfg.data.periods_per_day);
      setWorkingDays(cfg.data.working_days.join("، "));
      setResources(cfg.data.resources.join("، "));
    }
  }, [cfg.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("facility_config").update({
        periods_per_day: periods,
        working_days: workingDays.split(/[,،]/).map((s) => s.trim()).filter(Boolean),
        resources: resources.split(/[,،]/).map((s) => s.trim()).filter(Boolean),
      }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["facility-config"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return <div className="text-muted-foreground">جاري التحميل...</div>;
  if (!isMaster) return <Navigate to="/" />;

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-3xl font-bold flex items-center gap-2"><SettingsIcon className="h-7 w-7 text-primary" /> الإعدادات</h2>
      <div className="glass rounded-2xl p-6 space-y-4">
        <div><Label>عدد الحصص في اليوم</Label><Input type="number" min={1} max={12} value={periods} onChange={(e) => setPeriods(Number(e.target.value))} /></div>
        <div><Label>أيام العمل (مفصولة بفاصلة)</Label><Input value={workingDays} onChange={(e) => setWorkingDays(e.target.value)} /></div>
        <div><Label>المرافق المتاحة (مفصولة بفاصلة)</Label><Input value={resources} onChange={(e) => setResources(e.target.value)} /></div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full gradient-primary text-primary-foreground">حفظ</Button>
      </div>
    </div>
  );
}
