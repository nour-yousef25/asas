import { createHash, randomBytes } from "node:crypto";
import { SocialPlatform } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getOrganizationContext } from "@/lib/organization-context";

function baseUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_APP_URL مطلوب لبدء تفويض OAuth.");
  }
  return new URL(url).origin;
}

export function callbackUrl(platform: SocialPlatform) {
  return `${baseUrl()}/api/integrations/${platform.toLowerCase()}/callback`;
}

export function codeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export async function beginOAuth(platform: SocialPlatform, requestedScopes: string[]) {
  const context = await getOrganizationContext();
  const state = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(48).toString("base64url");
  const redirectUri = callbackUrl(platform);
  await prisma.oAuthState.create({
    data: {
      organizationId: context.organizationId,
      userId: context.userId,
      platform,
      state,
      codeVerifier,
      redirectUri,
      requestedScopes,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  return { context, state, codeVerifier };
}
