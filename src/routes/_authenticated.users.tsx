import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useRoles, type AppRole, ROLE_LABELS } from "@/hooks/useRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserCog, Trash2, KeyRound, Eye, Mail, Phone as PhoneIcon, Calendar } from "lucide-react";
import { toast } from "sonner";
import { adminDeleteUser, adminResetPassword, adminGetAuthUsers } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
});

function UsersPage() {
  const { isReallyMaster, loading } = useRoles();
  const qc = useQueryClient();
  const delFn = useServerFn(adminDeleteUser);
  const getAuth = useServerFn(adminGetAuthUsers);

  const profiles = useQuery({
    queryKey: ["all-profiles"],
    enabled: isReallyMaster,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const authUsers = useQuery({
    queryKey: ["auth-users"],
    enabled: isReallyMaster,
    queryFn: async () => {
      const list = await getAuth();
      return new Map(list.map((u) => [u.id, u]));
    },
  });

  const roles = useQuery({
    queryKey: ["all-user-roles"],
    enabled: isReallyMaster,
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

  const removeUser = useMutation({
    mutationFn: async (userId: string) => { await delFn({ data: { userId } }); },
    onSuccess: () => {
      toast.success("تم حذف المستخدم");
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
      qc.invalidateQueries({ queryKey: ["all-user-roles"] });
      qc.invalidateQueries({ queryKey: ["auth-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return <div className="text-muted-foreground">جاري التحميل...</div>;
  if (!isReallyMaster) return <Navigate to="/" />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold flex items-center gap-2"><UserCog className="h-7 w-7 text-primary" /> حسابات المستخدمين</h2>
        <p className="text-sm text-muted-foreground mt-1">عيّن دوراً، اعرض التفاصيل، أو احذف الحساب نهائياً.</p>
      </div>

      <div className="space-y-2">
        {profiles.data?.map((p) => {
          const userRoles = roles.data?.get(p.id) ?? [];
          const auth = authUsers.data?.get(p.id);
          return (
            <div key={p.id} className="glass rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
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
                <UserDetailsDialog profile={p} auth={auth ?? null} />
                <ResetPasswordDialog userId={p.id} email={p.email ?? ""} />
                <Button
                  size="sm" variant="ghost"
                  onClick={() => { if (confirm(`حذف ${p.full_name ?? p.email}؟ هذا الإجراء نهائي.`)) removeUser.mutate(p.id); }}
                  className="text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {p.phone && <span className="flex items-center gap-1"><PhoneIcon className="h-3 w-3" /> {p.phone}</span>}
                {auth?.last_sign_in_at && <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> آخر دخول: {new Date(auth.last_sign_in_at).toLocaleDateString("ar")}</span>}
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> سُجِّل: {new Date(p.created_at).toLocaleDateString("ar")}</span>
                {auth && !auth.confirmed && <span className="text-warning">⚠ غير مؤكد</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UserDetailsDialog({ profile, auth }: { profile: { id: string; full_name: string | null; email: string | null; phone: string | null; created_at: string }; auth: { last_sign_in_at: string | null; confirmed: boolean } | null }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>تفاصيل المستخدم</DialogTitle></DialogHeader>
        <div className="space-y-2 text-sm">
          <Row label="الاسم الكامل" value={profile.full_name ?? "—"} />
          <Row label="البريد الإلكتروني" value={profile.email ?? "—"} ltr />
          <Row label="الجوال" value={profile.phone ?? "—"} ltr />
          <Row label="تاريخ التسجيل" value={new Date(profile.created_at).toLocaleString("ar")} />
          <Row label="آخر دخول" value={auth?.last_sign_in_at ? new Date(auth.last_sign_in_at).toLocaleString("ar") : "—"} />
          <Row label="تأكيد البريد" value={auth?.confirmed ? "✓ مؤكد" : "⚠ غير مؤكد"} />
          <Row label="المعرّف" value={profile.id} ltr small />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, ltr, small }: { label: string; value: string; ltr?: boolean; small?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-1 border-b border-border/30">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${small ? "text-xs" : ""} font-medium truncate`} dir={ltr ? "ltr" : "rtl"}>{value}</span>
    </div>
  );
}

function ResetPasswordDialog({ userId, email }: { userId: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const fn = useServerFn(adminResetPassword);
  const m = useMutation({
    mutationFn: async () => { await fn({ data: { userId, newPassword: pwd } }); },
    onSuccess: () => { toast.success("تم تغيير كلمة المرور"); setOpen(false); setPwd(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="ghost"><KeyRound className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>تغيير كلمة المرور</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> <span dir="ltr">{email}</span></p>
          <div><Label>كلمة المرور الجديدة</Label><Input type="text" dir="ltr" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="8 أحرف على الأقل" /></div>
          <Button onClick={() => m.mutate()} disabled={pwd.length < 8 || m.isPending} className="w-full gradient-primary text-primary-foreground">
            {m.isPending ? "..." : "تغيير"}
          </Button>
          <p className="text-xs text-muted-foreground">انسخ كلمة المرور وأرسلها للمستخدم بأمان.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
