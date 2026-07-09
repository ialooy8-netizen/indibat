import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* eslint-disable @typescript-eslint/no-explicit-any */

const GATEWAY_URL = "https://connector-gateway.lovable.dev";

/**
 * Send an SMS via GatewayAPI (preferred for Gulf/Bahrain) or Twilio.
 * Requires the appropriate connector to be linked (GATEWAYAPI_API_KEY or TWILIO_API_KEY)
 * plus LOVABLE_API_KEY (always present on Lovable Cloud).
 */
export const sendSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    to: z.string().min(6),               // E.164 e.g. +97333xxxxxx
    message: z.string().min(1).max(1000),
    provider: z.enum(["auto", "gatewayapi", "twilio"]).default("auto"),
    sender: z.string().max(11).optional(), // sender id (GatewayAPI) / from number (Twilio)
    reference: z.string().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: isStaff } = await sb.rpc("is_staff", { _user_id: context.userId });
    if (!isStaff) throw new Error("غير مصرّح");

    const lovableKey = process.env.LOVABLE_API_KEY;
    if (!lovableKey) throw new Error("LOVABLE_API_KEY غير مُهيَّأ");

    const gwKey = process.env.GATEWAYAPI_API_KEY;
    const twKey = process.env.TWILIO_API_KEY;
    const useGw = data.provider === "gatewayapi" || (data.provider === "auto" && gwKey);
    const useTw = data.provider === "twilio" || (data.provider === "auto" && !gwKey && twKey);

    if (useGw) {
      if (!gwKey) throw new Error("GatewayAPI غير متصل — اربط الموفّر من إعدادات النظام");
      const digits = data.to.replace(/[^0-9]/g, "");
      const recipient = Number(digits);
      const res = await fetch(`${GATEWAY_URL}/gatewayapi/mobile/single`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": gwKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: data.sender || "EduPulse",
          recipient,
          message: data.message,
          reference: data.reference,
        }),
      });
      const body = await res.text();
      if (!res.ok) throw new Error(`GatewayAPI [${res.status}]: ${body}`);
      await logSent(sb, context.userId, "gatewayapi", data.to, data.message);
      return { ok: true, provider: "gatewayapi" as const };
    }

    if (useTw) {
      if (!twKey) throw new Error("Twilio غير متصل — اربط الموفّر من إعدادات النظام");
      const from = data.sender;
      if (!from) throw new Error("رقم Twilio (From) مطلوب");
      const params = new URLSearchParams({ To: data.to, From: from, Body: data.message });
      const res = await fetch(`${GATEWAY_URL}/twilio/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": twKey,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });
      const body = await res.text();
      if (!res.ok) throw new Error(`Twilio [${res.status}]: ${body}`);
      await logSent(sb, context.userId, "twilio", data.to, data.message);
      return { ok: true, provider: "twilio" as const };
    }

    throw new Error("لا يوجد موفّر SMS متصل. اربط GatewayAPI أو Twilio أولاً.");
  });

async function logSent(sb: any, userId: string, provider: string, to: string, message: string) {
  try {
    await sb.from("parent_comms_log").insert({
      sent_by: userId,
      channel: `sms:${provider}`,
      to_phone: to,
      body: message,
    });
  } catch { /* logging is best-effort */ }
}

