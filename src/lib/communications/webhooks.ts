/**
 * تحقق Webhooks خادمي. يُحفظ الحدث بعد التحقق فقط ولا تُعاد معالجة الرسائل المكررة.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { SocialPlatform } from "@prisma/client";

function same(left: string, right: string) {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function webhookEventKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export function verifyMetaWebhook(raw: string, signature: string | null) {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  return same(expected, signature);
}

export function verifyTikTokWebhook(raw: string, signature: string | null) {
  const secret = process.env.TIKTOK_CLIENT_SECRET;
  if (!secret || !signature) return false;
  const fields = Object.fromEntries(signature.split(",").map((part) => part.trim().split("=")).filter(([key, value]) => key && value));
  const timestamp = fields.t; const received = fields.s;
  if (!timestamp || !received || Math.abs(Date.now() / 1000 - Number(timestamp)) > 5 * 60) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  return same(expected, received);
}

export function verifyXWebhook(raw: string, signature: string | null) {
  const secret = process.env.X_CONSUMER_SECRET || process.env.X_CLIENT_SECRET;
  if (!secret || !signature) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("base64")}`;
  return same(expected, signature);
}

export function xCrcResponse(crcToken: string) {
  const secret = process.env.X_CONSUMER_SECRET || process.env.X_CLIENT_SECRET;
  if (!secret) throw new Error("X_CONSUMER_SECRET غير مضبوط.");
  return `sha256=${createHmac("sha256", secret).update(crcToken).digest("base64")}`;
}

export function verifyWebhook(platform: SocialPlatform, raw: string, headers: Headers) {
  if (platform === SocialPlatform.FACEBOOK || platform === SocialPlatform.INSTAGRAM) return verifyMetaWebhook(raw, headers.get("x-hub-signature-256"));
  if (platform === SocialPlatform.TIKTOK) return verifyTikTokWebhook(raw, headers.get("tiktok-signature"));
  if (platform === SocialPlatform.X) return verifyXWebhook(raw, headers.get("x-twitter-webhooks-signature"));
  // YouTube WebSub لا يقدم توقيعًا في المسار القياسي؛ لا ننفذ منه أي كتابة حساسة.
  return platform === SocialPlatform.YOUTUBE;
}
