/**
 * تنفيذ خطة نشر واحدة بصورة idempotent؛ يستدعى من عامل Redis أو من نشر فوري معتمد.
 */
import { CommunicationWorkflowStatus, ConnectedChannelStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/communications/crypto";
import { classifyProviderError, publishToProvider } from "@/lib/communications/connectors";

export async function publishPlanById(publicationPlanId: string) {
  const plan = await prisma.publicationPlan.findUnique({
    where: { id: publicationPlanId },
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

  const previousAttempt = await prisma.publicationAttempt.findFirst({ where: { publicationPlanId: plan.id, status: CommunicationWorkflowStatus.PUBLISHED }, orderBy: { attemptNumber: "desc" } });
  if (previousAttempt) return { skipped: true, reason: "ALREADY_PUBLISHED", providerPublicationId: previousAttempt.providerPublicationId };

  const attemptNumber = await prisma.publicationAttempt.count({ where: { publicationPlanId: plan.id } }) + 1;
  const idempotencyKey = `asas:${plan.id}:${attemptNumber}`;
  const attempt = await prisma.publicationAttempt.create({
    data: { publicationPlanId: plan.id, attemptNumber, idempotencyKey, status: CommunicationWorkflowStatus.PUBLISHING },
  });
  await prisma.$transaction([
    prisma.publicationPlan.update({ where: { id: plan.id }, data: { status: CommunicationWorkflowStatus.PUBLISHING } }),
    prisma.channelVariant.update({ where: { id: plan.channelVariantId }, data: { status: CommunicationWorkflowStatus.PUBLISHING } }),
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
    await prisma.$transaction([
      prisma.publicationAttempt.update({ where: { id: attempt.id }, data: { status: completedStatus, providerPublicationId: result.providerPublicationId, providerUrl: result.providerUrl, completedAt: completedStatus === CommunicationWorkflowStatus.PUBLISHED ? new Date() : null } }),
      prisma.publicationPlan.update({ where: { id: plan.id }, data: { status: completedStatus } }),
      prisma.channelVariant.update({ where: { id: plan.channelVariantId }, data: { status: completedStatus } }),
    ]);
    return { skipped: false, status: completedStatus, providerPublicationId: result.providerPublicationId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر النشر بسبب استجابة غير متوقعة من المنصة.";
    const errorClass = classifyProviderError(message);
    await prisma.$transaction([
      prisma.publicationAttempt.update({ where: { id: attempt.id }, data: { status: CommunicationWorkflowStatus.FAILED, errorClass, userMessage: message, technicalMessage: message, completedAt: new Date() } }),
      prisma.publicationPlan.update({ where: { id: plan.id }, data: { status: CommunicationWorkflowStatus.FAILED } }),
      prisma.channelVariant.update({ where: { id: plan.channelVariantId }, data: { status: CommunicationWorkflowStatus.FAILED } }),
      ...(errorClass === "TOKEN_EXPIRED" || errorClass === "ACCESS_REVOKED" ? [prisma.connectedChannel.update({ where: { id: channel.id }, data: { status: ConnectedChannelStatus.NEEDS_REAUTH, reauthReason: message } })] : []),
    ]);
    throw new Error(message);
  }
}
