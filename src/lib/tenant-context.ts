import { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type TenantContext = Readonly<{
  organizationId: string;
  membershipId: string;
  userId: string;
  sessionVersion: number;
  policySnapshotVersion: number;
  correlationId: string;
}>;

export type ResolvedTenantContext = TenantContext & Readonly<{ role: Role }>;

export class TenantAuthorizationError extends Error {
  constructor(
    public readonly code:
      | "UNAUTHENTICATED"
      | "STALE_SESSION"
      | "STALE_POLICY"
      | "NO_ACTIVE_MEMBERSHIP"
      | "FORBIDDEN_TENANT_RESOURCE",
    message: string,
  ) {
    super(message);
    this.name = "TenantAuthorizationError";
  }
}

function correlationId() {
  return crypto.randomUUID();
}

export async function resolveTenantContextForUser(input: {
  userId: string;
  authVersion: number;
  correlationId?: string;
}): Promise<ResolvedTenantContext> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      isActive: true,
      authVersion: true,
      activeOrganizationId: true,
      organizationMemberships: {
        where: { isActive: true, revokedAt: null },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        select: { id: true, organizationId: true, role: true, policyVersion: true },
      },
    },
  });

  if (!user?.isActive) {
    throw new TenantAuthorizationError("UNAUTHENTICATED", "غير مصرح");
  }
  if (user.authVersion !== input.authVersion) {
    throw new TenantAuthorizationError("STALE_SESSION", "انتهت صلاحية الجلسة. سجّل الدخول مرة أخرى.");
  }

  const membership = user.activeOrganizationId
    ? user.organizationMemberships.find((item) => item.organizationId === user.activeOrganizationId)
    : undefined;
  if (!membership) {
    throw new TenantAuthorizationError("NO_ACTIVE_MEMBERSHIP", "لا توجد عضوية نشطة في أي منظمة.");
  }

  return Object.freeze({
    organizationId: membership.organizationId,
    membershipId: membership.id,
    userId: user.id,
    sessionVersion: user.authVersion,
    role: membership.role,
    policySnapshotVersion: membership.policyVersion,
    correlationId: input.correlationId ?? correlationId(),
  });
}

export async function requireTenantContext(): Promise<ResolvedTenantContext> {
  const session = await auth();
  if (!session?.user?.id || typeof session.user.authVersion !== "number") {
    throw new TenantAuthorizationError("UNAUTHENTICATED", "غير مصرح");
  }
  return resolveTenantContextForUser({
    userId: session.user.id,
    authVersion: session.user.authVersion,
  });
}

export async function switchActiveOrganization(input: {
  userId: string;
  authVersion: number;
  organizationId: string;
  correlationId?: string;
}): Promise<ResolvedTenantContext> {
  const context = await resolveTenantContextForUser({
    userId: input.userId,
    authVersion: input.authVersion,
    correlationId: input.correlationId,
  });
  const membership = await prisma.organizationMembership.findFirst({
    where: {
      organizationId: input.organizationId,
      userId: context.userId,
      isActive: true,
      revokedAt: null,
    },
    select: { id: true },
  });
  if (!membership) {
    await prisma.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "TENANT_CONTEXT_SWITCH_DENIED",
        entity: "OrganizationMembership",
        details: { requestedOrganizationId: input.organizationId, correlationId: context.correlationId },
      },
    });
    throw new TenantAuthorizationError("NO_ACTIVE_MEMBERSHIP", "لا تملك عضوية نشطة في المنظمة المطلوبة.");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: context.userId },
      data: { activeOrganizationId: input.organizationId },
    }),
    prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: context.userId,
        action: "TENANT_CONTEXT_SWITCHED",
        entity: "OrganizationMembership",
        entityId: membership.id,
        details: { correlationId: context.correlationId },
      },
    }),
  ]);

  return resolveTenantContextForUser({
    userId: context.userId,
    authVersion: input.authVersion,
    correlationId: context.correlationId,
  });
}

export async function invalidateUserSessions(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { authVersion: { increment: 1 } },
    select: { id: true, authVersion: true },
  });
}

export async function bumpMembershipPolicyVersion(membershipId: string) {
  return prisma.organizationMembership.update({
    where: { id: membershipId },
    data: { policyVersion: { increment: 1 } },
    select: { id: true, policyVersion: true },
  });
}

export async function assertTenantPolicySnapshot(context: TenantContext) {
  const membership = await prisma.organizationMembership.findFirst({
    where: {
      id: context.membershipId,
      organizationId: context.organizationId,
      userId: context.userId,
      isActive: true,
      revokedAt: null,
    },
    select: { policyVersion: true },
  });
  if (!membership || membership.policyVersion !== context.policySnapshotVersion) {
    throw new TenantAuthorizationError("STALE_POLICY", "انتهت صلاحية سياق السياسة. أعد حل سياق المنظمة.");
  }
}

export function assertTenantResource(context: TenantContext, resourceOrganizationId: string) {
  if (context.organizationId !== resourceOrganizationId) {
    throw new TenantAuthorizationError("FORBIDDEN_TENANT_RESOURCE", "المورد غير متاح ضمن المنظمة النشطة.");
  }
}
