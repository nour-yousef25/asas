import { PermissionEffect, PlatformSupportAccessStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertSeparationOfDuties, evaluatePermission } from "@/lib/policy";
import type { TenantContext } from "@/lib/tenant-context";

export class IamAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IamAuthorizationError";
  }
}

async function requireRoleManagement(context: TenantContext) {
  const decision = await evaluatePermission(context, "identity.role.manage");
  if (!decision.allowed) throw new IamAuthorizationError(`Role management denied: ${decision.reason}`);
}

async function rolePermissionNames(membershipId: string) {
  const membership = await prisma.organizationMembership.findUnique({
    where: { id: membershipId },
    include: {
      organizationRoles: { include: { organizationRole: { include: { permissions: { include: { permission: true } } } } } },
    },
  });
  return membership?.organizationRoles.flatMap((assignment) => assignment.organizationRole.permissions
    .filter((binding) => binding.effect === PermissionEffect.ALLOW)
    .map((binding) => binding.permission.name)) ?? [];
}

export async function assignOrganizationRole(input: {
  context: TenantContext;
  membershipId: string;
  organizationRoleId: string;
}) {
  await requireRoleManagement(input.context);
  const [membership, role] = await Promise.all([
    prisma.organizationMembership.findFirst({ where: { id: input.membershipId, organizationId: input.context.organizationId, isActive: true, revokedAt: null } }),
    prisma.organizationRole.findFirst({ where: { id: input.organizationRoleId, organizationId: input.context.organizationId }, include: { permissions: { include: { permission: true } } } }),
  ]);
  if (!membership || !role) throw new IamAuthorizationError("Role or membership is outside the active organization.");
  if (membership.userId === input.context.userId && role.permissions.some((binding) => binding.permission.name === "identity.role.manage")) {
    throw new IamAuthorizationError("Self escalation is forbidden.");
  }
  assertSeparationOfDuties([...await rolePermissionNames(membership.id), ...role.permissions.filter((binding) => binding.effect === PermissionEffect.ALLOW).map((binding) => binding.permission.name)]);

  return prisma.$transaction(async (tx) => {
    await tx.membershipRole.upsert({
      where: { membershipId_organizationRoleId: { membershipId: membership.id, organizationRoleId: role.id } },
      create: { membershipId: membership.id, organizationRoleId: role.id },
      update: {},
    });
    const updated = await tx.organizationMembership.update({ where: { id: membership.id }, data: { policyVersion: { increment: 1 } } });
    await tx.auditLog.create({
      data: { organizationId: input.context.organizationId, userId: input.context.userId, action: "IAM_ROLE_ASSIGNED", entity: "OrganizationMembership", entityId: membership.id, details: { roleId: role.id, correlationId: input.context.correlationId } },
    });
    return updated;
  });
}

export async function setMembershipPermissionOverride(input: {
  context: TenantContext;
  membershipId: string;
  permissionName: string;
  effect: PermissionEffect;
  reason: string;
  expiresAt?: Date;
}) {
  await requireRoleManagement(input.context);
  const [membership, permission] = await Promise.all([
    prisma.organizationMembership.findFirst({ where: { id: input.membershipId, organizationId: input.context.organizationId } }),
    prisma.permission.findUnique({ where: { name: input.permissionName } }),
  ]);
  if (!membership || !permission) throw new IamAuthorizationError("Unknown membership or permission in active organization.");
  return prisma.$transaction(async (tx) => {
    await tx.membershipPermissionOverride.upsert({
      where: { membershipId_permissionId: { membershipId: membership.id, permissionId: permission.id } },
      create: { membershipId: membership.id, permissionId: permission.id, effect: input.effect, reason: input.reason, expiresAt: input.expiresAt },
      update: { effect: input.effect, reason: input.reason, expiresAt: input.expiresAt },
    });
    const updated = await tx.organizationMembership.update({ where: { id: membership.id }, data: { policyVersion: { increment: 1 } } });
    await tx.auditLog.create({
      data: { organizationId: input.context.organizationId, userId: input.context.userId, action: "IAM_PERMISSION_OVERRIDE_SET", entity: "OrganizationMembership", entityId: membership.id, details: { permission: input.permissionName, effect: input.effect, correlationId: input.context.correlationId } },
    });
    return updated;
  });
}

export async function requestPlatformSupportAccess(input: {
  context: TenantContext;
  reason: string;
  purposeCode: string;
  expiresAt: Date;
}) {
  const decision = await evaluatePermission(input.context, "support.access.request");
  if (!decision.allowed) throw new IamAuthorizationError(`Support request denied: ${decision.reason}`);
  return prisma.platformSupportAccess.create({
    data: { organizationId: input.context.organizationId, requesterId: input.context.userId, reason: input.reason, purposeCode: input.purposeCode, expiresAt: input.expiresAt, readOnly: true },
  });
}

export async function approvePlatformSupportAccess(input: { context: TenantContext; accessId: string }) {
  const decision = await evaluatePermission(input.context, "support.access.approve");
  if (!decision.allowed) throw new IamAuthorizationError(`Support approval denied: ${decision.reason}`);
  const access = await prisma.platformSupportAccess.findFirst({ where: { id: input.accessId, organizationId: input.context.organizationId, status: PlatformSupportAccessStatus.REQUESTED } });
  if (!access || access.requesterId === input.context.userId) throw new IamAuthorizationError("Support request cannot be self-approved.");
  return prisma.platformSupportAccess.update({ where: { id: access.id }, data: { status: PlatformSupportAccessStatus.APPROVED, approverId: input.context.userId } });
}
