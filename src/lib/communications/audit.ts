/** سجل تدقيق مركز الاتصال: لا تُسجل الرموز أو أسرار الموصلات ضمن التفاصيل. */
import { type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function writeCommunicationAudit(input: {
  organizationId: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
}) {
  return prisma.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      details: input.details as Prisma.InputJsonValue | undefined,
    },
  });
}
