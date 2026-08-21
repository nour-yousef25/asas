/**
 * Webhooks القنوات: نقطة عامة لا تستخدم جلسة المستخدم، وتتحقق من التوقيع قبل الحفظ.
 * يجب تسجيل هذا الرابط HTTPS في لوحة مزود القناة بعد ضبط أسرار التطبيق.
 */
import { NextRequest, NextResponse } from "next/server";
import { CommunicationWorkflowStatus, SocialPlatform, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { verifyWebhook, webhookEventKey, xCrcResponse } from "@/lib/communications/webhooks";

function platformFromParam(value: string) {
  const upper = value.toUpperCase();
  return Object.values(SocialPlatform).includes(upper as SocialPlatform) ? upper as SocialPlatform : null;
}

function externalChannelId(platform: SocialPlatform, payload: Record<string, unknown>) {
  if (platform === SocialPlatform.FACEBOOK || platform === SocialPlatform.INSTAGRAM) {
    const entry = Array.isArray(payload.entry) ? payload.entry[0] as Record<string, unknown> | undefined : undefined;
    return typeof entry?.id === "string" ? entry.id : undefined;
  }
  if (platform === SocialPlatform.TIKTOK) return typeof payload.open_id === "string" ? payload.open_id : typeof (payload.data as Record<string, unknown> | undefined)?.open_id === "string" ? String((payload.data as Record<string, unknown>).open_id) : undefined;
  if (platform === SocialPlatform.X) return typeof payload.for_user_id === "string" ? payload.for_user_id : undefined;
  if (platform === SocialPlatform.YOUTUBE) return typeof payload.channelId === "string" ? payload.channelId : undefined;
  return undefined;
}

async function applyTikTokPublicationUpdate(payload: Record<string, unknown>) {
  const data = (payload.data || payload) as Record<string, unknown>;
  const publishId = typeof data.publish_id === "string" ? data.publish_id : undefined;
  const event = typeof payload.event === "string" ? payload.event : typeof payload.event_type === "string" ? payload.event_type : "";
  if (!publishId || !event.includes("post.publish")) return;
  const attempt = await prisma.publicationAttempt.findFirst({ where: { providerPublicationId: publishId }, include: { publicationPlan: true } });
  if (!attempt) return;
  if (event === "post.publish.complete" || event === "post.publish.publicly_available") {
    await prisma.$transaction([
      prisma.publicationAttempt.update({ where: { id: attempt.id }, data: { status: CommunicationWorkflowStatus.PUBLISHED, completedAt: new Date() } }),
      prisma.publicationPlan.update({ where: { id: attempt.publicationPlanId }, data: { status: CommunicationWorkflowStatus.PUBLISHED } }),
      prisma.channelVariant.update({ where: { id: attempt.publicationPlan.channelVariantId }, data: { status: CommunicationWorkflowStatus.PUBLISHED } }),
    ]);
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform: raw } = await params; const platform = platformFromParam(raw);
  if (!platform) return NextResponse.json({ error: "منصة غير مدعومة." }, { status: 404 });
  if ((platform === SocialPlatform.FACEBOOK || platform === SocialPlatform.INSTAGRAM) && request.nextUrl.searchParams.get("hub.mode") === "subscribe") {
    const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
    if (expected && request.nextUrl.searchParams.get("hub.verify_token") === expected) return new NextResponse(request.nextUrl.searchParams.get("hub.challenge") || "", { status: 200 });
    return NextResponse.json({ error: "رمز تحقق Meta غير صحيح." }, { status: 403 });
  }
  if (platform === SocialPlatform.X && request.nextUrl.searchParams.get("crc_token")) return NextResponse.json({ response_token: xCrcResponse(request.nextUrl.searchParams.get("crc_token")!) });
  if (platform === SocialPlatform.YOUTUBE && request.nextUrl.searchParams.get("hub.challenge")) return new NextResponse(request.nextUrl.searchParams.get("hub.challenge") || "", { status: 200 });
  return NextResponse.json({ error: "طلب تحقق غير مدعوم." }, { status: 400 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform: raw } = await params; const platform = platformFromParam(raw);
  if (!platform) return NextResponse.json({ error: "منصة غير مدعومة." }, { status: 404 });
  const body = await request.text();
  if (!verifyWebhook(platform, body, request.headers)) return NextResponse.json({ error: "توقيع Webhook غير صالح." }, { status: 401 });
  const payload = JSON.parse(body) as Record<string, unknown>;
  const externalId = externalChannelId(platform, payload);
  const channel = externalId ? await prisma.connectedChannel.findFirst({ where: { platform, externalId } }) : null;
  // الرد ناجح حتى إن كان الحدث غير تابع لقناة مسجلة، منعًا لإعادة تسليم غير مفيدة.
  if (!channel) return NextResponse.json({ accepted: true, linked: false });
  const eventId = webhookEventKey(body);
  await prisma.webhookEvent.upsert({
    where: { organizationId_platform_externalEventId: { organizationId: channel.organizationId, platform, externalEventId: eventId } },
    create: { organizationId: channel.organizationId, platform, externalEventId: eventId, connectedChannelExternalId: externalId, signatureValid: true, payload: payload as Prisma.InputJsonValue },
    update: {},
  });
  if (platform === SocialPlatform.TIKTOK) await applyTikTokPublicationUpdate(payload);
  return NextResponse.json({ accepted: true, linked: true });
}
