import { PermissionEffect, PlatformSupportAccessStatus, type PrismaClient } from "@prisma/client";
import { requireTenantBoundPrismaExecutor } from "@/lib/tenant-bound-prisma-authority";
import type { TenantContext } from "@/lib/tenant-context";

export type PolicyDecision = Readonly<{
  allowed: boolean;
  reason: "ALLOW" | "DEFAULT_DENY" | "EXPLICIT_DENY" | "STALE_POLICY" | "MEMBERSHIP_MISMATCH";
}>;

export class PolicyAuthorizationError extends Error {
  constructor(public readonly decision: PolicyDecision) {
    super(`Permission denied: ${decision.reason}`);
    this.name = "PolicyAuthorizationError";
  }
}

const SOD_CONFLICTS = [
  ["donation.create", "donation.approve"],
  ["donation.create", "donation.refund"],
  ["support.access.request", "support.access.approve"],
] as const;

export function assertSeparationOfDuties(permissionNames: readonly string[]) {
  for (const [first, second] of SOD_CONFLICTS) {
    if (permissionNames.includes(first) && permissionNames.includes(second)) {
      throw new Error(`SoD violation: ${first} cannot be combined with ${second}.`);
    }
  }
}

async function evaluatePermissionWithPrisma(db: PrismaClient, context: TenantContext, permissionName: string): Promise<PolicyDecision> {
  const membership = await db.organizationMembership.findFirst({
    where: {
      id: context.membershipId,
      organizationId: context.organizationId,
      userId: context.userId,
      isActive: true,
      revokedAt: null,
    },
    include: {
      organizationRoles: { include: { organizationRole: { include: { permissions: { include: { permission: true } } } } } },
      permissionOverrides: { include: { permission: true } },
    },
  });
  if (!membership) return { allowed: false, reason: "MEMBERSHIP_MISMATCH" };
  if (membership.policyVersion !== context.policySnapshotVersion) return { allowed: false, reason: "STALE_POLICY" };

  const now = new Date();
  const overrides = membership.permissionOverrides.filter((item) => item.permission.name === permissionName && (!item.expiresAt || item.expiresAt > now));
  const effects = [
    ...overrides.map((item) => item.effect),
    ...membership.organizationRoles.flatMap((assignment) => assignment.organizationRole.permissions
      .filter((item) => item.permission.name === permissionName)
      .map((item) => item.effect)),
  ];
  if (effects.includes(PermissionEffect.DENY)) return { allowed: false, reason: "EXPLICIT_DENY" };
  if (effects.includes(PermissionEffect.ALLOW)) return { allowed: true, reason: "ALLOW" };
  return { allowed: false, reason: "DEFAULT_DENY" };
}

export async function evaluatePermission(context: TenantContext, permissionName: string): Promise<PolicyDecision> {
  return requireTenantBoundPrismaExecutor().execute(context, (db) => evaluatePermissionWithPrisma(db, context, permissionName));
}

export async function requirePermission(context: TenantContext, permissionName: string) {
  const decision = await evaluatePermission(context, permissionName);
  if (!decision.allowed) throw new PolicyAuthorizationError(decision);
  return decision;
}

export async function hasApprovedSupportReadAccess(input: {
  context: TenantContext;
  requesterId: string;
  classification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
}) {
  if (input.classification === "RESTRICTED") return false;
  const access = await requireTenantBoundPrismaExecutor().execute(input.context, (db) => db.platformSupportAccess.findFirst({
    where: {
      organizationId: input.context.organizationId,
      requesterId: input.requesterId,
      status: PlatformSupportAccessStatus.APPROVED,
      readOnly: true,
      expiresAt: { gt: new Date() },
      revokedAt: null,
    },
  }));
  return Boolean(access);
}
