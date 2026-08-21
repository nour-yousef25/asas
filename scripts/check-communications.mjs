/** فحوصات وحدات بلا شبكة لمركز الاتصال الرقمي. */
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";

process.env.INTEGRATIONS_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.TIKTOK_CLIENT_SECRET = "local-webhook-test-secret";

const [{ SocialPlatform }, { inspectContent }, { decryptSecret, encryptSecret }, { verifyTikTokWebhook }] = await Promise.all([
  import("@prisma/client"),
  import("../src/lib/communications/content-guard.ts"),
  import("../src/lib/communications/crypto.ts"),
  import("../src/lib/communications/webhooks.ts"),
]);

const secret = "رمز وصول لا يخرج من الخادم";
assert.equal(decryptSecret(encryptSecret(secret)), secret, "يجب أن يعيد التشفير القيمة الأصلية.");

const warnings = inspectContent({ platform: SocialPlatform.X, copy: "ن".repeat(281), assetUrls: [] });
assert.ok(warnings.some((item) => item.code === "X_LENGTH"), "يجب تنبيه المحرر عند تجاوز حد X.");

const tiktokErrors = inspectContent({ platform: SocialPlatform.TIKTOK, copy: "محتوى", assetUrls: [] });
assert.ok(tiktokErrors.some((item) => item.code === "TIKTOK_MEDIA_REQUIRED"), "يجب منع TikTok بلا وسيط.");

const payload = JSON.stringify({ event: "post.publish.complete", data: { publish_id: "example" } });
const timestamp = Math.floor(Date.now() / 1000).toString();
const signature = createHmac("sha256", process.env.TIKTOK_CLIENT_SECRET).update(`${timestamp}.${payload}`).digest("hex");
assert.equal(verifyTikTokWebhook(payload, `t=${timestamp},s=${signature}`), true, "يجب قبول توقيع TikTok الصالح.");
assert.equal(verifyTikTokWebhook(payload, `t=${timestamp},s=invalid`), false, "يجب رفض توقيع TikTok غير الصالح.");

console.log("✓ اجتازت فحوصات مركز الاتصال: التشفير، الحراسة التحريرية، وتوقيع TikTok.");
