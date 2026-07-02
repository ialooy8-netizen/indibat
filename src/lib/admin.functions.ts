import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function assertMaster(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "master" });
  if (error) throw new Error("فشل التحقق من الصلاحية");
  if (!data) throw new Error("غير مصرّح — هذا الإجراء للماستر فقط");
}

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertMaster(context.supabase as any, context.userId);
    if (data.userId === context.userId) throw new Error("لا يمكنك حذف حسابك");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    userId: z.string().uuid(),
    newPassword: z.string().min(8, "كلمة المرور 8 أحرف على الأقل"),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertMaster(context.supabase as any, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).auth.admin.updateUserById(data.userId, { password: data.newPassword });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminGetAuthUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMaster(context.supabase as any, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any).auth.admin.listUsers({ page: 1, perPage: 500 });
    if (error) throw new Error(error.message);
    return (data.users as Array<any>).map((u) => ({
      id: u.id as string,
      email: (u.email ?? null) as string | null,
      last_sign_in_at: (u.last_sign_in_at ?? null) as string | null,
      created_at: u.created_at as string,
      phone: (u.phone ?? null) as string | null,
      confirmed: !!u.email_confirmed_at,
    }));
  });

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    email: z.string().email(),
    password: z.string().min(8),
    fullName: z.string().min(1),
    phone: z.string().optional(),
    role: z.enum(["principal","vice_principal","teacher","print_manager"]).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertMaster(context.supabase as any, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await (supabaseAdmin as any).auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
      phone: data.phone || undefined,
    });
    if (error) throw new Error(error.message);
    const uid = created.user.id as string;
    // Ensure profile has phone (handle_new_user trigger inserts name/email)
    if (data.phone) {
      await (supabaseAdmin as any).from("profiles").update({ phone: data.phone, full_name: data.fullName }).eq("id", uid);
    }
    if (data.role) {
      await (supabaseAdmin as any).from("user_roles").insert({ user_id: uid, role: data.role });
    }
    return { ok: true, userId: uid };
  });
