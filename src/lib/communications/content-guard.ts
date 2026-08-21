import { SocialPlatform } from "@prisma/client";

export type ContentGuardFinding = {
  code: string;
  level: "warning" | "error";
  message: string;
};

export function inspectContent(input: { platform: SocialPlatform; copy: string; assetUrls: string[] }): ContentGuardFinding[] {
  const findings: ContentGuardFinding[] = [];
  if (input.platform === SocialPlatform.X && input.copy.length > 280) {
    findings.push({ code: "X_LENGTH", level: "warning", message: "تتجاوز النسخة الحد النصي الإرشادي لمنصة X." });
  }
  if ((input.platform === SocialPlatform.TIKTOK || input.platform === SocialPlatform.INSTAGRAM || input.platform === SocialPlatform.YOUTUBE) && input.assetUrls.length === 0) {
    findings.push({ code: `${input.platform}_MEDIA_REQUIRED`, level: "error", message: "تتطلب القناة وسيطًا عامًا مناسبًا للنشر." });
  }
  if (/\b\d{10}\b/.test(input.copy)) {
    findings.push({ code: "POSSIBLE_IDENTIFIER", level: "warning", message: "راجع المحتوى لاحتمال احتوائه على معرف شخصي قبل النشر." });
  }
  return findings;
}
