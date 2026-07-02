import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const submitEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid().optional(),
    event_name: z.string().min(2),
    description: z.string().min(10),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    if (data.id) {
      const { error } = await sb.from("event_submissions")
        .update({ event_name: data.event_name, description: data.description, status: "pending", reviewer_note: null })
        .eq("id", data.id).eq("teacher_id", context.userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await sb.from("event_submissions")
      .insert({ teacher_id: context.userId, event_name: data.event_name, description: data.description })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const reviewEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid(),
    action: z.enum(["approved","rejected","needs_edits"]),
    note: z.string().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: isAdmin } = await sb.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("غير مصرّح — للمدير/المساعد فقط");

    const { data: ev, error: fetchErr } = await sb.from("event_submissions").select("teacher_id, event_name").eq("id", data.id).single();
    if (fetchErr) throw new Error(fetchErr.message);

    const { error } = await sb.from("event_submissions").update({
      status: data.action,
      reviewer_id: context.userId,
      reviewer_note: data.note ?? null,
      reviewed_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (error) throw new Error(error.message);

    // Notification to teacher
    const label = data.action === "approved" ? "اعتُمدت فعاليتك" : data.action === "rejected" ? "رُفضت فعاليتك" : "طُلبت تعديلات على فعاليتك";
    await sb.from("notifications").insert({
      user_id: ev.teacher_id,
      title: `${label}: ${ev.event_name}`,
      body: data.note ?? null,
      link_to: "/events",
      kind: "event",
    });
    return { ok: true };
  });
