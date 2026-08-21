/**
 * مساعد تحريري قابل للاستبدال: يعتمد قواعد شفافة افتراضيًا، ويستدعي مزودًا موثقًا فقط إذا ضُبط خادميًا.
 */
import { SocialPlatform } from "@prisma/client";

type Proposal = { title: string; copy: string; cta?: string; hashtags?: string[]; notices: string[] };

function localGuidance(input: { platform: SocialPlatform; title: string; body: string; hashtags: string[] }): Proposal {
  const platformLabel = { FACEBOOK: "Facebook", INSTAGRAM: "Instagram", LINKEDIN: "LinkedIn", TIKTOK: "TikTok", YOUTUBE: "YouTube", X: "X" }[input.platform];
  const shortBody = input.body.replace(/\s+/g, " ").trim();
  const notices = ["اقتراح تحريري مبدئي؛ لا يُنشر تلقائيًا ويحتاج مراجعة بشرية."];
  if (input.platform === SocialPlatform.X && shortBody.length > 280) notices.push("اختصر النسخة قبل النشر على X لتفادي تجاوز الحد النصي.");
  if (input.platform === SocialPlatform.INSTAGRAM || input.platform === SocialPlatform.TIKTOK) notices.push("تحقق من إرفاق وسيط مناسب وإتاحة الرابط للمنصة عند النشر.");
  if (input.platform === SocialPlatform.YOUTUBE) notices.push("جهز عنوان الفيديو ووصفه وكلمات البحث والملف الفعلي قبل رفعه.");
  return { title: `${input.title} — نسخة ${platformLabel}`, copy: shortBody, cta: "للتفاصيل والمشاركة، تواصلوا معنا عبر القنوات الرسمية للجمعية.", hashtags: input.hashtags.slice(0, 6), notices };
}

export async function proposeEditorialVariant(input: { platform: SocialPlatform; title: string; body: string; hashtags: string[] }): Promise<Proposal> {
  const endpoint = process.env.ASAS_AI_ENDPOINT;
  const token = process.env.ASAS_AI_API_KEY;
  if (!endpoint || !token) return localGuidance(input);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ task: "adapt_social_copy", locale: "ar-SA", ...input }),
    cache: "no-store",
  });
  if (!response.ok) return localGuidance(input);
  const json = await response.json() as Partial<Proposal>;
  return {
    title: typeof json.title === "string" ? json.title : input.title,
    copy: typeof json.copy === "string" ? json.copy : input.body,
    cta: typeof json.cta === "string" ? json.cta : undefined,
    hashtags: Array.isArray(json.hashtags) ? json.hashtags.filter((tag): tag is string => typeof tag === "string").slice(0, 12) : input.hashtags.slice(0, 6),
    notices: Array.isArray(json.notices) ? json.notices.filter((notice): notice is string => typeof notice === "string") : ["اقتراح مُنشأ بواسطة مزود التحرير المهيأ؛ راجعه قبل الاعتماد."],
  };
}
