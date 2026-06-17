import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRoles, type AppRole } from "@/hooks/useRoles";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { UserCog, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
});

const ROLE_LABELS: Record<AppRole, string> = {
  master: "الماستر",
  principal: "مدير المدرسة",
  teacher: "معلم",
  print_manager: "مسؤول الطباعة",
};

function UsersPage() {
  const { isMaster, loading } = useRoles();
  const qc = useQueryClient();

  const profiles = useQuery({
    queryKey: ["all-profiles"],
    enabled: isMaster,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const roles = useQuery({
    queryKey: ["all-user-roles"],
    enabled: isMaster,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      const map = new Map<string, AppRole[]>();
      for (const r of data) {
        const arr = map.get(r.user_id) ?? [];
        arr.push(r.role as AppRole);
        map.set(r.user_id, arr);
      }
      return map;
    },
  });

  const addRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم تعيين الدور"); qc.invalidateQueries({ queryKey: ["all-user-roles"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["all-user-roles"] }); },
  });

  if (loading) return <div className="text-muted-foreground">جاري التحميل...</div>;
  if (!isMaster) return <Navigate to="/" />;

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold flex items-center gap-2"><UserCog className="h-7 w-7 text-primary" /> حسابات المستخدمين</h2>
      <p className="text-sm text-muted-foreground">عيّن دوراً لكل مستخدم جديد. بدون دور لا يستطيع المستخدم استعمال النظام.</p>

      <div className="space-y-2">
        {profiles.data?.map((p) => {
          const userRoles = roles.data?.get(p.id) ?? [];
          return (
            <div key={p.id} className="glass rounded-xl p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="font-semibold">{p.full_name ?? "—"}</div>
                <div className="text-xs text-muted-foreground" dir="ltr">{p.email}</div>
              </div>
              <div className="flex flex-wrap gap-1">
                {userRoles.map((r) => (
                  <span key={r} className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary flex items-center gap-1">
                    {ROLE_LABELS[r]}
                    <button onClick={() => removeRole.mutate({ userId: p.id, role: r })} className="hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <Select onValueChange={(role) => addRole.mutate({ userId: p.id, role: role as AppRole })}>
                <SelectTrigger className="w-44"><SelectValue placeholder="إضافة دور..." /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as AppRole[]).filter((r) => !userRoles.includes(r)).map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
