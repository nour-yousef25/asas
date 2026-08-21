import { SocialPlatform } from "@prisma/client";

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  FACEBOOK: "Facebook Pages",
  INSTAGRAM: "Instagram Professional",
  LINKEDIN: "LinkedIn Pages",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  X: "X",
};

export const PLATFORM_CAPABILITIES: Record<SocialPlatform, Record<string, boolean>> = {
  FACEBOOK: { oauth: true, publishing: true, metrics: true, webhooks: true, scheduling: true },
  INSTAGRAM: { oauth: true, publishing: true, metrics: true, webhooks: true, scheduling: true },
  LINKEDIN: { oauth: true, publishing: true, metrics: true, webhooks: false, scheduling: true },
  TIKTOK: { oauth: true, publishing: true, metrics: true, webhooks: true, scheduling: true },
  YOUTUBE: { oauth: true, publishing: true, metrics: true, webhooks: false, scheduling: true },
  X: { oauth: true, publishing: true, metrics: true, webhooks: true, scheduling: true },
};
