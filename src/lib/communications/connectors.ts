/**
 * موصلات القنوات الرسمية. لا تُخزَّن أسرار المزود أو رموز المستخدم إلا مشفرة في الخادم.
 * التزام التصميم: سجلّ المؤسسة الهادئ — نتائج واضحة، قدرات معلنة، وفشل قابل للتشخيص.
 */
import { ConnectedChannelStatus, MetricKind, PublicationErrorClass, SocialPlatform, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/communications/crypto";
import { callbackUrl, codeChallenge } from "@/lib/communications/oauth";
import { PLATFORM_CAPABILITIES, PLATFORM_LABELS } from "@/lib/communications/types";

type ProviderConfig = { clientId: string; clientSecret: string; apiVersion?: string };
type TokenBundle = { accessToken: string; refreshToken?: string; expiresAt?: Date; refreshExpiresAt?: Date; scope?: string[]; metadata?: Record<string, unknown> };
export type ChannelCandidate = { externalId: string; displayName: string; accountType?: string; accessToken?: string; refreshToken?: string; expiresAt?: Date; refreshExpiresAt?: Date; scopes: string[]; metadata?: Record<string, unknown> };
type PublishInput = { channel: { externalId: string; platform: SocialPlatform; metadata: unknown }; accessToken: string; copy: string; assetUrls: string[]; payload: unknown };
export type PublishResult = { providerPublicationId: string; providerUrl?: string; state?: "PUBLISHED" | "PROCESSING" };

function env(...names: string[]) {
  for (const name of names) if (process.env[name]) return process.env[name]!;
  return undefined;
}

export function getProviderConfig(platform: SocialPlatform): ProviderConfig {
  const configurations: Record<SocialPlatform, ProviderConfig | undefined> = {
    FACEBOOK: (() => { const clientId = env("META_APP_ID"); const clientSecret = env("META_APP_SECRET"); return clientId && clientSecret ? { clientId, clientSecret, apiVersion: env("META_GRAPH_API_VERSION") || "v26.0" } : undefined; })(),
    INSTAGRAM: (() => { const clientId = env("META_APP_ID"); const clientSecret = env("META_APP_SECRET"); return clientId && clientSecret ? { clientId, clientSecret, apiVersion: env("META_GRAPH_API_VERSION") || "v26.0" } : undefined; })(),
    LINKEDIN: (() => { const clientId = env("LINKEDIN_CLIENT_ID"); const clientSecret = env("LINKEDIN_CLIENT_SECRET"); return clientId && clientSecret ? { clientId, clientSecret } : undefined; })(),
    TIKTOK: (() => { const clientId = env("TIKTOK_CLIENT_KEY"); const clientSecret = env("TIKTOK_CLIENT_SECRET"); return clientId && clientSecret ? { clientId, clientSecret } : undefined; })(),
    YOUTUBE: (() => { const clientId = env("GOOGLE_CLIENT_ID"); const clientSecret = env("GOOGLE_CLIENT_SECRET"); return clientId && clientSecret ? { clientId, clientSecret } : undefined; })(),
    X: (() => { const clientId = env("X_CLIENT_ID"); const clientSecret = env("X_CLIENT_SECRET"); return clientId && clientSecret ? { clientId, clientSecret } : undefined; })(),
  };
  const config = configurations[platform];
  if (!config) throw new Error(`إعدادات ${PLATFORM_LABELS[platform]} غير مكتملة. أضف بيانات اعتماد التطبيق في مخزن الأسرار أولًا.`);
  return config;
}

export const platformScopes: Record<SocialPlatform, string[]> = {
  FACEBOOK: ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "pages_manage_engagement", "pages_manage_metadata", "publish_video", "read_insights"],
  INSTAGRAM: ["instagram_basic", "instagram_content_publish", "instagram_manage_insights", "instagram_manage_comments", "pages_show_list", "pages_read_engagement", "pages_manage_metadata"],
  LINKEDIN: ["r_basicprofile", "r_organization_social", "w_organization_social", "rw_organization_admin"],
  TIKTOK: ["user.info.basic", "user.info.stats", "video.publish", "video.list"],
  YOUTUBE: ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube", "https://www.googleapis.com/auth/yt-analytics.readonly"],
  X: ["tweet.read", "tweet.write", "users.read", "media.write", "offline.access"],
};

export function authorizeUrl(platform: SocialPlatform, input: { state: string; codeVerifier: string }) {
  const config = getProviderConfig(platform);
  const redirectUri = callbackUrl(platform);
  const scopes = platformScopes[platform];
  const search = new URLSearchParams({ state: input.state });

  if (platform === SocialPlatform.FACEBOOK || platform === SocialPlatform.INSTAGRAM) {
    search.set("client_id", config.clientId); search.set("redirect_uri", redirectUri); search.set("response_type", "code"); search.set("scope", scopes.join(","));
    return `https://www.facebook.com/${config.apiVersion}/dialog/oauth?${search.toString()}`;
  }
  if (platform === SocialPlatform.LINKEDIN) {
    search.set("response_type", "code"); search.set("client_id", config.clientId); search.set("redirect_uri", redirectUri); search.set("scope", scopes.join(" "));
    return `https://www.linkedin.com/oauth/v2/authorization?${search.toString()}`;
  }
  if (platform === SocialPlatform.TIKTOK) {
    search.set("client_key", config.clientId); search.set("response_type", "code"); search.set("redirect_uri", redirectUri); search.set("scope", scopes.join(","));
    return `https://www.tiktok.com/v2/auth/authorize/?${search.toString()}`;
  }
  if (platform === SocialPlatform.YOUTUBE) {
    search.set("client_id", config.clientId); search.set("redirect_uri", redirectUri); search.set("response_type", "code"); search.set("access_type", "offline"); search.set("prompt", "consent"); search.set("scope", scopes.join(" "));
    return `https://accounts.google.com/o/oauth2/v2/auth?${search.toString()}`;
  }
  search.set("client_id", config.clientId); search.set("response_type", "code"); search.set("redirect_uri", redirectUri); search.set("scope", scopes.join(" ")); search.set("code_challenge", codeChallenge(input.codeVerifier)); search.set("code_challenge_method", "S256");
  return `https://api.x.com/2/oauth2/authorize?${search.toString()}`;
}

async function responseJson(response: Response) {
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof json?.error_description === "string" ? json.error_description : typeof json?.error?.message === "string" ? json.error.message : "رفض مزود القناة الطلب.");
  return json as Record<string, unknown>;
}

async function formPost(url: string, values: Record<string, string>) {
  return responseJson(await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(values), cache: "no-store" }));
}

export async function exchangeAuthorizationCode(platform: SocialPlatform, code: string, codeVerifier?: string): Promise<TokenBundle> {
  const config = getProviderConfig(platform);
  const redirectUri = callbackUrl(platform);
  if (platform === SocialPlatform.FACEBOOK || platform === SocialPlatform.INSTAGRAM) {
    const json = await responseJson(await fetch(`https://graph.facebook.com/${config.apiVersion}/oauth/access_token?${new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: redirectUri, code })}`, { cache: "no-store" }));
    return { accessToken: String(json.access_token), expiresAt: json.expires_in ? new Date(Date.now() + Number(json.expires_in) * 1000) : undefined };
  }
  if (platform === SocialPlatform.LINKEDIN) {
    const json = await formPost("https://www.linkedin.com/oauth/v2/accessToken", { grant_type: "authorization_code", code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: redirectUri });
    return { accessToken: String(json.access_token), refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : undefined, expiresAt: json.expires_in ? new Date(Date.now() + Number(json.expires_in) * 1000) : undefined, refreshExpiresAt: json.refresh_token_expires_in ? new Date(Date.now() + Number(json.refresh_token_expires_in) * 1000) : undefined, scope: typeof json.scope === "string" ? json.scope.split(/\s+/) : [] };
  }
  if (platform === SocialPlatform.TIKTOK) {
    const json = await formPost("https://open.tiktokapis.com/v2/oauth/token/", { client_key: config.clientId, client_secret: config.clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri });
    return { accessToken: String(json.access_token), refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : undefined, expiresAt: json.expires_in ? new Date(Date.now() + Number(json.expires_in) * 1000) : undefined, refreshExpiresAt: json.refresh_expires_in ? new Date(Date.now() + Number(json.refresh_expires_in) * 1000) : undefined, scope: typeof json.scope === "string" ? json.scope.split(",") : [], metadata: { openId: json.open_id } };
  }
  if (platform === SocialPlatform.YOUTUBE) {
    const json = await formPost("https://oauth2.googleapis.com/token", { code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" });
    return { accessToken: String(json.access_token), refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : undefined, expiresAt: json.expires_in ? new Date(Date.now() + Number(json.expires_in) * 1000) : undefined, scope: typeof json.scope === "string" ? json.scope.split(/\s+/) : [] };
  }
  const json = await formPost("https://api.x.com/2/oauth2/token", { code, grant_type: "authorization_code", client_id: config.clientId, redirect_uri: redirectUri, code_verifier: codeVerifier || "" });
  return { accessToken: String(json.access_token), refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : undefined, expiresAt: json.expires_in ? new Date(Date.now() + Number(json.expires_in) * 1000) : undefined, scope: typeof json.scope === "string" ? json.scope.split(/\s+/) : [] };
}

export async function discoverChannels(platform: SocialPlatform, token: TokenBundle): Promise<ChannelCandidate[]> {
  const bearer = { Authorization: `Bearer ${token.accessToken}` };
  if (platform === SocialPlatform.FACEBOOK || platform === SocialPlatform.INSTAGRAM) {
    const fields = platform === SocialPlatform.INSTAGRAM ? "id,name,access_token,instagram_business_account" : "id,name,access_token,category,tasks";
    const json = await responseJson(await fetch(`https://graph.facebook.com/${getProviderConfig(platform).apiVersion}/me/accounts?fields=${encodeURIComponent(fields)}`, { headers: bearer, cache: "no-store" }));
    const accounts = Array.isArray(json.data) ? json.data as Array<Record<string, unknown>> : [];
    if (platform === SocialPlatform.FACEBOOK) return accounts.map((a) => ({ externalId: String(a.id), displayName: String(a.name || "صفحة Facebook"), accountType: "PAGE", accessToken: typeof a.access_token === "string" ? a.access_token : token.accessToken, scopes: token.scope || platformScopes[platform], metadata: { category: a.category, tasks: a.tasks } }));
    return accounts.filter((a) => a.instagram_business_account).map((a) => { const ig = a.instagram_business_account as Record<string, unknown>; return { externalId: String(ig.id), displayName: String(a.name || "Instagram Professional"), accountType: "PROFESSIONAL", accessToken: typeof a.access_token === "string" ? a.access_token : token.accessToken, scopes: token.scope || platformScopes[platform], metadata: { pageId: a.id, instagramAccountId: ig.id } }; });
  }
  if (platform === SocialPlatform.YOUTUBE) {
    const json = await responseJson(await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: bearer, cache: "no-store" }));
    const items = Array.isArray(json.items) ? json.items as Array<Record<string, unknown>> : [];
    return items.map((item) => { const snippet = item.snippet as Record<string, unknown> | undefined; return { externalId: String(item.id), displayName: String(snippet?.title || "قناة YouTube"), accountType: "CHANNEL", scopes: token.scope || platformScopes[platform], metadata: { thumbnail: (snippet?.thumbnails as Record<string, unknown> | undefined)?.default } }; });
  }
  if (platform === SocialPlatform.TIKTOK) {
    const openId = String(token.metadata?.openId || "");
    if (!openId) throw new Error("لم تعد TikTok معرّف الحساب بعد التفويض.");
    return [{ externalId: openId, displayName: "حساب TikTok", accountType: "CREATOR", scopes: token.scope || platformScopes[platform] }];
  }
  if (platform === SocialPlatform.X) {
    const json = await responseJson(await fetch("https://api.x.com/2/users/me", { headers: bearer, cache: "no-store" }));
    const data = (json.data || {}) as Record<string, unknown>;
    return [{ externalId: String(data.id), displayName: String(data.name || data.username || "حساب X"), accountType: "ACCOUNT", scopes: token.scope || platformScopes[platform], metadata: { username: data.username } }];
  }
  // LinkedIn: لا تُقبل قناة مجهولة؛ يعرض هذا الحساب مرحلة التحقق حتى يكتشف المستخدم صفحة مؤسسة يملكها.
  return [{ externalId: "pending-organization-selection", displayName: "اختر صفحة المؤسسة من LinkedIn بعد الموافقة", accountType: "ORGANIZATION_PENDING", scopes: token.scope || platformScopes[platform], metadata: { connectionPending: true } }];
}

export async function persistChannels(input: { organizationId: string; userId: string; platform: SocialPlatform; token: TokenBundle; candidates: ChannelCandidate[] }) {
  const channels = [];
  for (const candidate of input.candidates) {
    const accessToken = candidate.accessToken || input.token.accessToken;
    const channel = await prisma.connectedChannel.upsert({
      where: { organizationId_platform_externalId: { organizationId: input.organizationId, platform: input.platform, externalId: candidate.externalId } },
      create: { organizationId: input.organizationId, platform: input.platform, externalId: candidate.externalId, displayName: candidate.displayName, accountType: candidate.accountType, status: candidate.metadata?.connectionPending ? ConnectedChannelStatus.CONFIGURATION_REQUIRED : ConnectedChannelStatus.READY, scopes: candidate.scopes, capabilities: PLATFORM_CAPABILITIES[input.platform] as Prisma.InputJsonValue, metadata: candidate.metadata as Prisma.InputJsonValue | undefined, createdById: input.userId },
      update: { displayName: candidate.displayName, accountType: candidate.accountType, status: candidate.metadata?.connectionPending ? ConnectedChannelStatus.CONFIGURATION_REQUIRED : ConnectedChannelStatus.READY, scopes: candidate.scopes, capabilities: PLATFORM_CAPABILITIES[input.platform] as Prisma.InputJsonValue, metadata: candidate.metadata as Prisma.InputJsonValue | undefined, reauthReason: null },
    });
    await prisma.channelCredential.upsert({
      where: { connectedChannelId: channel.id },
      create: { connectedChannelId: channel.id, encryptedAccessToken: encryptSecret(accessToken), encryptedRefreshToken: (candidate.refreshToken || input.token.refreshToken) ? encryptSecret(candidate.refreshToken || input.token.refreshToken!) : null, expiresAt: candidate.expiresAt || input.token.expiresAt, refreshExpiresAt: candidate.refreshExpiresAt || input.token.refreshExpiresAt },
      update: { encryptedAccessToken: encryptSecret(accessToken), encryptedRefreshToken: (candidate.refreshToken || input.token.refreshToken) ? encryptSecret(candidate.refreshToken || input.token.refreshToken!) : null, expiresAt: candidate.expiresAt || input.token.expiresAt, refreshExpiresAt: candidate.refreshExpiresAt || input.token.refreshExpiresAt },
    });
    channels.push(channel);
  }
  return channels;
}

export async function revokeChannel(channelId: string) {
  const channel = await prisma.connectedChannel.findUnique({ where: { id: channelId }, include: { credential: true } });
  if (!channel) return;
  if (channel.credential && channel.platform === SocialPlatform.TIKTOK) {
    const config = getProviderConfig(SocialPlatform.TIKTOK);
    await formPost("https://open.tiktokapis.com/v2/oauth/revoke/", { client_key: config.clientId, client_secret: config.clientSecret, token: decryptSecret(channel.credential.encryptedAccessToken) }).catch(() => undefined);
  }
  await prisma.connectedChannel.update({ where: { id: channelId }, data: { status: ConnectedChannelStatus.DISCONNECTED, reauthReason: "تم فصل القناة بواسطة المستخدم" } });
}

export function classifyProviderError(message: string): PublicationErrorClass {
  const normalized = message.toLowerCase();
  if (/token.*(expired|invalid)|auth.*expired/.test(normalized)) return PublicationErrorClass.TOKEN_EXPIRED;
  if (/permission|forbidden|scope|not authorized/.test(normalized)) return PublicationErrorClass.PERMISSION_DENIED;
  if (/rate|limit|quota/.test(normalized)) return PublicationErrorClass.RATE_LIMIT;
  if (/media|format|video|image/.test(normalized)) return PublicationErrorClass.INVALID_MEDIA;
  if (/timeout|timed out/.test(normalized)) return PublicationErrorClass.PROVIDER_TIMEOUT;
  if (/review|audit|unaudited/.test(normalized)) return PublicationErrorClass.APP_REVIEW_RESTRICTION;
  return PublicationErrorClass.UNKNOWN;
}

function isVideoAsset(url: string) {
  return /\.(mp4|mov|m4v|webm)(?:[?#]|$)/i.test(url);
}

function publicAssetUrl(raw: string) {
  const url = new URL(raw);
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || hostname === "localhost" || hostname.endsWith(".local") || /^127\./.test(hostname) || /^10\./.test(hostname) || /^192\.168\./.test(hostname) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) {
    throw new Error("رابط الوسيط يجب أن يكون HTTPS عامًا عبر نطاق تخزين أو CDN موثوق، ولا يسمح بعناوين داخلية.");
  }
  return url.toString();
}

async function createInstagramContainer(input: { endpoint: string; accessToken: string; assetUrl: string; copy?: string; carouselItem?: boolean }) {
  const video = isVideoAsset(input.assetUrl);
  const body = {
    ...(video ? { video_url: input.assetUrl, media_type: input.carouselItem ? "VIDEO" : "REELS" } : { image_url: input.assetUrl }),
    ...(input.copy ? { caption: input.copy } : {}),
    ...(input.carouselItem ? { is_carousel_item: true } : {}),
  };
  return responseJson(await fetch(input.endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${input.accessToken}` }, body: JSON.stringify(body) }));
}

async function tiktokPrivacyLevel(accessToken: string) {
  const json = await responseJson(await fetch("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" }, body: "{}" }));
  const data = (json.data || {}) as Record<string, unknown>;
  const options = Array.isArray(data.privacy_level_options) ? data.privacy_level_options.filter((value): value is string => typeof value === "string") : [];
  return options.includes("PUBLIC_TO_EVERYONE") ? "PUBLIC_TO_EVERYONE" : options[0] || "SELF_ONLY";
}

async function uploadYouTubeVideo(input: { accessToken: string; assetUrl: string; title: string; description: string; tags: string[]; payload: unknown }) {
  const media = await fetch(input.assetUrl, { cache: "no-store" });
  if (!media.ok) throw new Error("تعذر جلب ملف الفيديو من رابط التخزين العام لرفعه إلى YouTube.");
  const contentType = media.headers.get("content-type") || "video/*";
  if (!contentType.startsWith("video/") && contentType !== "application/octet-stream") throw new Error("الوسيط المرفق ليس ملف فيديو صالحًا لرفع YouTube.");
  const file = Buffer.from(await media.arrayBuffer());
  const metadata = (input.payload || {}) as Record<string, unknown>;
  const status = (metadata.youtubeStatus || {}) as Record<string, unknown>;
  const initial = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(file.byteLength),
      "X-Upload-Content-Type": contentType,
    },
    body: JSON.stringify({ snippet: { title: input.title.slice(0, 100), description: input.description, tags: input.tags, categoryId: String(metadata.youtubeCategoryId || "22") }, status: { privacyStatus: status.privacyStatus === "private" || status.privacyStatus === "unlisted" ? status.privacyStatus : "public", selfDeclaredMadeForKids: Boolean(status.selfDeclaredMadeForKids) } }),
  });
  if (!initial.ok) await responseJson(initial);
  const uploadUrl = initial.headers.get("location");
  if (!uploadUrl) throw new Error("لم يعد YouTube رابط جلسة الرفع القابلة للاستئناف.");
  const completed = await responseJson(await fetch(uploadUrl, { method: "PUT", headers: { Authorization: `Bearer ${input.accessToken}`, "Content-Type": contentType, "Content-Length": String(file.byteLength), "Content-Range": `bytes 0-${Math.max(0, file.byteLength - 1)}/${file.byteLength}` }, body: file }));
  return { providerPublicationId: String(completed.id), providerUrl: `https://www.youtube.com/watch?v=${String(completed.id)}` };
}

export async function publishToProvider(input: PublishInput): Promise<PublishResult> {
  const { channel, accessToken, copy, assetUrls } = input;
  if (channel.platform === SocialPlatform.FACEBOOK) {
    const endpoint = assetUrls[0] ? `https://graph.facebook.com/${getProviderConfig(channel.platform).apiVersion}/${channel.externalId}/photos` : `https://graph.facebook.com/${getProviderConfig(channel.platform).apiVersion}/${channel.externalId}/feed`;
    const body = assetUrls[0] ? { url: assetUrls[0], caption: copy } : { message: copy };
    const json = await responseJson(await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(body) }));
    const id = String(json.post_id || json.id); return { providerPublicationId: id, providerUrl: `https://www.facebook.com/${id}` };
  }
  if (channel.platform === SocialPlatform.INSTAGRAM) {
    if (!assetUrls[0]) throw new Error("Instagram يحتاج وسيطًا عامًا قابلًا للوصول للنشر.");
    const config = getProviderConfig(channel.platform);
    const endpoint = `https://graph.facebook.com/${config.apiVersion}/${channel.externalId}/media`;
    const safeAssets = assetUrls.map(publicAssetUrl);
    const container = safeAssets.length > 1
      ? await (async () => {
        const children = await Promise.all(safeAssets.slice(0, 10).map((assetUrl) => createInstagramContainer({ endpoint, accessToken, assetUrl, carouselItem: true })));
        return responseJson(await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ media_type: "CAROUSEL", children: children.map((child) => String(child.id)).join(","), caption: copy }) }));
      })()
      : await createInstagramContainer({ endpoint, accessToken, assetUrl: safeAssets[0], copy });
    const published = await responseJson(await fetch(`https://graph.facebook.com/${config.apiVersion}/${channel.externalId}/media_publish`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ creation_id: container.id }) }));
    return { providerPublicationId: String(published.id) };
  }
  if (channel.platform === SocialPlatform.LINKEDIN) {
    const json = await responseJson(await fetch("https://api.linkedin.com/rest/posts", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", "Linkedin-Version": "202608", "X-Restli-Protocol-Version": "2.0.0" }, body: JSON.stringify({ author: `urn:li:organization:${channel.externalId}`, commentary: copy, visibility: "PUBLIC", distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] }, lifecycleState: "PUBLISHED", isReshareDisabledByAuthor: false }) }));
    return { providerPublicationId: String(json.id || "linkedin-post") };
  }
  if (channel.platform === SocialPlatform.TIKTOK) {
    if (!assetUrls[0]) throw new Error("TikTok يحتاج رابط فيديو أو صورة متاحًا للنشر.");
    const safeAssets = assetUrls.map(publicAssetUrl);
    const privacyLevel = await tiktokPrivacyLevel(accessToken);
    const json = isVideoAsset(safeAssets[0])
      ? await responseJson(await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" }, body: JSON.stringify({ post_info: { title: copy.slice(0, 2200), privacy_level: privacyLevel, disable_comment: false, disable_duet: false, disable_stitch: false }, source_info: { source: "PULL_FROM_URL", video_url: safeAssets[0] } }) }))
      : await responseJson(await fetch("https://open.tiktokapis.com/v2/post/publish/content/init/", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" }, body: JSON.stringify({ media_type: "PHOTO", post_mode: "DIRECT_POST", post_info: { title: copy.slice(0, 90), description: copy.slice(0, 4000), privacy_level: privacyLevel, disable_comment: false, auto_add_music: true, brand_content_toggle: false, brand_organic_toggle: false }, source_info: { source: "PULL_FROM_URL", photo_cover_index: 0, photo_images: safeAssets.slice(0, 35) } }) }));
    const data = (json.data || {}) as Record<string, unknown>; return { providerPublicationId: String(data.publish_id), state: "PROCESSING" };
  }
  if (channel.platform === SocialPlatform.YOUTUBE) {
    if (!assetUrls[0]) throw new Error("YouTube يحتاج رابط فيديو HTTPS عامًا من تخزين موثوق.");
    return uploadYouTubeVideo({ accessToken, assetUrl: publicAssetUrl(assetUrls[0]), title: typeof (input.payload as Record<string, unknown> | null)?.title === "string" ? String((input.payload as Record<string, unknown>).title) : copy.slice(0, 100), description: copy, tags: [], payload: input.payload });
  }
  const json = await responseJson(await fetch("https://api.x.com/2/tweets", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ text: copy }) }));
  const data = (json.data || {}) as Record<string, unknown>; return { providerPublicationId: String(data.id), providerUrl: `https://x.com/i/web/status/${String(data.id)}` };
}

function numeric(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function graphMetricValues(json: Record<string, unknown>, map: Record<string, MetricKind>) {
  const data = Array.isArray(json.data) ? json.data as Array<Record<string, unknown>> : [];
  return data.flatMap((item) => {
    const name = typeof item.name === "string" ? item.name : "";
    const latest = Array.isArray(item.values) ? item.values.at(-1) as Record<string, unknown> | undefined : undefined;
    const value = numeric(latest?.value);
    return name && value !== null && map[name] ? [{ metric: map[name], value, raw: item }] : [];
  });
}

export async function syncChannelMetrics(channelId: string) {
  const channel = await prisma.connectedChannel.findUnique({ where: { id: channelId }, include: { credential: true } });
  if (!channel?.credential) throw new Error("القناة لا تملك تفويضًا صالحًا لجلب المؤشرات.");
  const accessToken = decryptSecret(channel.credential.encryptedAccessToken);
  const headers = { Authorization: `Bearer ${accessToken}` };
  let metrics: Array<{ metric: MetricKind; value: number; raw?: unknown }> = [];
  if (channel.platform === SocialPlatform.FACEBOOK) {
    const config = getProviderConfig(channel.platform);
    const json = await responseJson(await fetch(`https://graph.facebook.com/${config.apiVersion}/${channel.externalId}/insights?metric=page_post_engagements,page_impressions_unique&period=day`, { headers, cache: "no-store" }));
    metrics = graphMetricValues(json, { page_post_engagements: MetricKind.ENGAGEMENT, page_impressions_unique: MetricKind.REACH });
  } else if (channel.platform === SocialPlatform.INSTAGRAM) {
    const config = getProviderConfig(channel.platform);
    const json = await responseJson(await fetch(`https://graph.facebook.com/${config.apiVersion}/${channel.externalId}/insights?metric=reach,accounts_engaged&period=day`, { headers, cache: "no-store" }));
    metrics = graphMetricValues(json, { reach: MetricKind.REACH, accounts_engaged: MetricKind.ENGAGEMENT });
  } else if (channel.platform === SocialPlatform.TIKTOK) {
    const json = await responseJson(await fetch("https://open.tiktokapis.com/v2/user/info/?fields=follower_count,likes_count,video_count", { headers, cache: "no-store" }));
    const data = (json.data || {}) as Record<string, unknown>; const user = (data.user || {}) as Record<string, unknown>;
    metrics = [[MetricKind.FOLLOWERS, user.follower_count], [MetricKind.LIKES, user.likes_count], [MetricKind.VIDEO_VIEWS, user.video_count]].flatMap(([metric, value]) => { const parsed = numeric(value); return parsed === null ? [] : [{ metric: metric as MetricKind, value: parsed, raw: user }]; });
  } else if (channel.platform === SocialPlatform.YOUTUBE) {
    const endDate = new Date(); const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const params = new URLSearchParams({ ids: "channel==MINE", startDate: startDate.toISOString().slice(0, 10), endDate: endDate.toISOString().slice(0, 10), metrics: "views,likes,comments,shares" });
    const json = await responseJson(await fetch(`https://youtubeanalytics.googleapis.com/v2/reports?${params}`, { headers, cache: "no-store" }));
    const row = Array.isArray(json.rows) ? json.rows[0] as unknown[] | undefined : undefined;
    metrics = row ? [[MetricKind.VIEWS, row[0]], [MetricKind.LIKES, row[1]], [MetricKind.COMMENTS, row[2]], [MetricKind.SHARES, row[3]]].flatMap(([metric, value]) => { const parsed = numeric(value); return parsed === null ? [] : [{ metric: metric as MetricKind, value: parsed, raw: json }]; }) : [];
  } else if (channel.platform === SocialPlatform.X) {
    const json = await responseJson(await fetch(`https://api.x.com/2/users/${channel.externalId}?user.fields=public_metrics`, { headers, cache: "no-store" }));
    const data = (json.data || {}) as Record<string, unknown>; const publicMetrics = (data.public_metrics || {}) as Record<string, unknown>;
    metrics = [[MetricKind.FOLLOWERS, publicMetrics.followers_count], [MetricKind.LIKES, publicMetrics.like_count]].flatMap(([metric, value]) => { const parsed = numeric(value); return parsed === null ? [] : [{ metric: metric as MetricKind, value: parsed, raw: publicMetrics }]; });
  } else if (channel.platform === SocialPlatform.LINKEDIN) {
    // يتطلب هذا الاستدعاء موافقة Community Management ونسخة API محدثة؛ تحفظ النتيجة عند توفر الصلاحية.
    const json = await responseJson(await fetch(`https://api.linkedin.com/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(`urn:li:organization:${channel.externalId}`)}`, { headers: { ...headers, "Linkedin-Version": "202608", "X-Restli-Protocol-Version": "2.0.0" }, cache: "no-store" }));
    const elements = Array.isArray(json.elements) ? json.elements as Array<Record<string, unknown>> : [];
    const total = elements.reduce((sum, item) => { const value = numeric((item.totalShareStatistics as Record<string, unknown> | undefined)?.engagement); return sum + (value || 0); }, 0);
    metrics = total ? [{ metric: MetricKind.ENGAGEMENT, value: total, raw: json }] : [];
  }
  await prisma.$transaction([
    ...metrics.map((item) => prisma.metricSnapshot.create({ data: { organizationId: channel.organizationId, connectedChannelId: channel.id, metric: item.metric, value: item.value, raw: item.raw as Prisma.InputJsonValue | undefined } })),
    prisma.connectedChannel.update({ where: { id: channel.id }, data: { lastSyncedAt: new Date(), status: ConnectedChannelStatus.READY, reauthReason: null } }),
  ]);
  return { channelId: channel.id, metrics: metrics.map(({ metric, value }) => ({ metric, value })) };
}
