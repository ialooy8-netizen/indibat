import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* eslint-disable @typescript-eslint/no-explicit-any */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/microsoft_onedrive/v1.0";

/**
 * Upload a base64-encoded file to OneDrive under /EduPulse/<folder>/<filename>.
 * Requires the Microsoft OneDrive connector to be linked (MICROSOFT_ONEDRIVE_API_KEY).
 */
export const archiveToOneDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    folder: z.string().min(1).max(80).regex(/^[\w\- \u0600-\u06FF]+$/),
    filename: z.string().min(1).max(120).regex(/^[\w\-. \u0600-\u06FF]+$/),
    contentBase64: z.string().min(1),
    contentType: z.string().default("application/pdf"),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: isAdmin } = await sb.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("غير مصرّح — للماستر/المدير فقط");

    const lovableKey = process.env.LOVABLE_API_KEY;
    const oneKey = process.env.MICROSOFT_ONEDRIVE_API_KEY;
    if (!lovableKey) throw new Error("LOVABLE_API_KEY غير مُهيَّأ");
    if (!oneKey) throw new Error("OneDrive غير متصل — اربط الموفّر من إعدادات النظام");

    const bin = Uint8Array.from(atob(data.contentBase64), (c) => c.charCodeAt(0));
    const path = `EduPulse/${encodeURIComponent(data.folder)}/${encodeURIComponent(data.filename)}`;
    const res = await fetch(`${GATEWAY_URL}/me/drive/root:/${path}:/content`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": oneKey,
        "Content-Type": data.contentType,
      },
      body: bin,
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`OneDrive [${res.status}]: ${body}`);
    const j = JSON.parse(body);
    return { ok: true, id: j.id as string, webUrl: j.webUrl as string };
  });
