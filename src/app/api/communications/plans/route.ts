/** خطط النشر: لا يُسمح بجدولة نسخة لم تمر بالاعتماد أو لا تتبع الجمعية النشطة. */
import { NextRequest, NextResponse } from "next/server";
import { CommunicationWorkflowStatus } from "@prisma/client";
import { z } from "zod";
import { canApproveCommunications } from "@/lib/organization-context";
import { requireTenantContext } from "@/lib/tenant-context";
import { requirePermission } from "@/lib/policy";
import { requireTenantBoundPrismaExecutor } from "@/lib/tenant-bound-prisma-authority";
import { enqueuePublication, hasTenantDurableQueue, PUBLICATION_DISPATCH_PERMISSION } from "@/lib/tenant-queue";

const planSchema = z.object({ channelVariantId: z.string().cuid(), scheduledAt: z.string().datetime().optional(), timezone: z.string().min(3).max(64).default("Asia/Riyadh") });

export async function GET() {
  try {
    const context = await requireTenantContext();
    await requirePermission(context, PUBLICATION_DISPATCH_PERMISSION);
    const plans = await requireTenantBoundPrismaExecutor().execute(context, (db) => db.publicationPlan.findMany({
      where: { organizationId: context.organizationId },
      include: {
        channelVariant: {
          include: {
            contentItem: { select: { id: true, title: true, type: true } },
            connectedChannel: { select: { id: true, displayName: true, platform: true, status: true } },
          },
        },
      },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
      take: 150,
    }));
    return NextResponse.json({ plans, durableQueue: hasTenantDurableQueue() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تحميل خطط النشر." }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireTenantContext();
    await requirePermission(context, PUBLICATION_DISPATCH_PERMISSION);
    if (!canApproveCommunications(context.role)) return NextResponse.json({ error: "يتطلب اعتماد أو جدولة النشر دور مدير أو مشرف أعلى." }, { status: 403 });
    const parsed = planSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات الجدولة غير صالحة." }, { status: 400 });
    const executor = requireTenantBoundPrismaExecutor();
    const variant = await executor.execute(context, (db) => db.channelVariant.findFirst({ where: { id: parsed.data.channelVariantId, contentItem: { organizationId: context.organizationId } }, include: { connectedChannel: true } }));
    if (!variant) return NextResponse.json({ error: "نسخة القناة غير موجودة ضمن الجمعية النشطة." }, { status: 404 });
    if (variant.status !== CommunicationWorkflowStatus.APPROVED) return NextResponse.json({ error: "يلزم اعتماد نسخة القناة قبل الجدولة." }, { status: 400 });
    const scheduledAt = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null;
    if (scheduledAt && scheduledAt <= new Date()) return NextResponse.json({ error: "وقت الجدولة يجب أن يكون في المستقبل." }, { status: 400 });
    if (scheduledAt && !hasTenantDurableQueue()) return NextResponse.json({ error: "الجدولة تحتاج provider queue tenant-bound وعاملاً موثقاً. هذا المسار يفشل مغلقاً حتى تهيئتهما." }, { status: 409 });
    const plan = await executor.execute(context, (db) => db.$transaction(async (tx) => {
      const created = await tx.publicationPlan.create({ data: { organizationId: context.organizationId, channelVariantId: variant.id, scheduledAt, timezone: parsed.data.timezone, status: scheduledAt ? CommunicationWorkflowStatus.SCHEDULED : CommunicationWorkflowStatus.APPROVED, approvedById: context.userId } });
      await tx.auditLog.create({ data: { organizationId: context.organizationId, userId: context.userId, action: scheduledAt ? "COMMUNICATION_PUBLICATION_SCHEDULED" : "COMMUNICATION_PUBLICATION_READY", entity: "PublicationPlan", entityId: created.id, details: { channelVariantId: variant.id, scheduledAt: scheduledAt?.toISOString(), correlationId: context.correlationId } } });
      return created;
    }));
    if (scheduledAt) await enqueuePublication({ context, publicationPlanId: plan.id, delay: Math.max(0, scheduledAt.getTime() - Date.now()), options: { attempts: 4, backoff: { type: "exponential", delay: 30_000 } } });
    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر إنشاء خطة النشر." }, { status: 400 });
  }
}
