/**
 * تنفيذ خطة نشر واحدة بصورة idempotent؛ يستدعى من عامل Redis أو من نشر فوري معتمد.
 */
import { CommunicationWorkflowStatus, ConnectedChannelStatus, type PrismaClient } from "@prisma/client";
import type { TenantContext } from "@/lib/tenant-context";
import { requireTenantBoundPrismaExecutor } from "@/lib/tenant-bound-prisma-authority";
import { decryptSecret } from "@/lib/communications/crypto";
import { classifyProviderError, publishToProvider } from "@/lib/communications/connectors";

export async function publishPlanById(input: { context: TenantContext; publicationPlanId: string }) {
  return requireTenantBoundPrismaExecutor().execute(input.context, (db) => publishPlanWithPrisma(db, input));
}

export async function publishPlanWithPrisma(db: PrismaClient, input: { context: TenantContext; publicationPlanId: string }) {
  const plan = await db.publicationPlan.findFirst({
    where: { id: input.publicationPlanId, organizationId: input.context.organizationId },
    include: { channelVariant: { include: { contentItem: true, connectedChannel: { include: { credential: true } } } } },
  });
  if (!plan) throw new Error("خطة النشر غير موجودة.");
  if (
    plan.status === CommunicationWorkflowStatus.PUBLISHED ||
    plan.status === CommunicationWorkflowStatus.CANCELLED
  ) {
    return { skipped: true, reason: "FINAL_STATE" };
  }
  const channel = plan.channelVariant.connectedChannel;
  if (channel.status !== ConnectedChannelStatus.READY || !channel.credential) throw new Error("القناة غير جاهزة للنشر أو تحتاج إلى إعادة ربط.");

  const previousAttempt = await db.publicationAttempt.findFirst({ where: { publicationPlanId: plan.id, status: CommunicationWorkflowStatus.PUBLISHED }, orderBy: { attemptNumber: "desc" } });
  if (previousAttempt) return { skipped: true, reason: "ALREADY_PUBLISHED", providerPublicationId: previousAttempt.providerPublicationId };

  const attemptNumber = await db.publicationAttempt.count({ where: { publicationPlanId: plan.id } }) + 1;
  const idempotencyKey = `asas:${plan.id}:${attemptNumber}`;
  const attempt = await db.publicationAttempt.create({
    data: { publicationPlanId: plan.id, attemptNumber, idempotencyKey, status: CommunicationWorkflowStatus.PUBLISHING },
  });
  await db.$transaction([
    db.publicationPlan.update({ where: { id: plan.id }, data: { status: CommunicationWorkflowStatus.PUBLISHING } }),
    db.channelVariant.update({ where: { id: plan.channelVariantId }, data: { status: CommunicationWorkflowStatus.PUBLISHING } }),
  ]);

  try {
    const result = await publishToProvider({
      channel: { externalId: channel.externalId, platform: channel.platform, metadata: channel.metadata },
      accessToken: decryptSecret(channel.credential.encryptedAccessToken),
      copy: plan.channelVariant.copy,
      assetUrls: plan.channelVariant.assetUrls,
      payload: plan.channelVariant.payload,
    });
    const completedStatus = result.state === "PROCESSING" ? CommunicationWorkflowStatus.PUBLISHING : CommunicationWorkflowStatus.PUBLISHED;
    await db.$transaction([
      db.publicationAttempt.update({ where: { id: attempt.id }, data: { status: completedStatus, providerPublicationId: result.providerPublicationId, providerUrl: result.providerUrl, completedAt: completedStatus === CommunicationWorkflowStatus.PUBLISHED ? new Date() : null } }),
      db.publicationPlan.update({ where: { id: plan.id }, data: { status: completedStatus } }),
      db.channelVariant.update({ where: { id: plan.channelVariantId }, data: { status: completedStatus } }),
    ]);
    return { skipped: false, status: completedStatus, providerPublicationId: result.providerPublicationId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر النشر بسبب استجابة غير متوقعة من المنصة.";
    const errorClass = classifyProviderError(message);
    await db.$transaction([
      db.publicationAttempt.update({ where: { id: attempt.id }, data: { status: CommunicationWorkflowStatus.FAILED, errorClass, userMessage: message, technicalMessage: message, completedAt: new Date() } }),
      db.publicationPlan.update({ where: { id: plan.id }, data: { status: CommunicationWorkflowStatus.FAILED } }),
      db.channelVariant.update({ where: { id: plan.channelVariantId }, data: { status: CommunicationWorkflowStatus.FAILED } }),
      ...(errorClass === "TOKEN_EXPIRED" || errorClass === "ACCESS_REVOKED" ? [db.connectedChannel.update({ where: { id: channel.id }, data: { status: ConnectedChannelStatus.NEEDS_REAUTH, reauthReason: message } })] : []),
    ]);
    throw new Error(message);
  }
}
