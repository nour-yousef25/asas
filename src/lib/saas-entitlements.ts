import { EntitlementStatus, SubscriptionStatus, type PrismaClient } from "@prisma/client";
import type { TenantContext } from "@/lib/tenant-context";
import { requireTenantBoundPrismaExecutor, type TenantBoundPrismaExecutor } from "@/lib/tenant-bound-prisma-authority";

export type SaaSAccessState = "ACTIVE" | "SUSPENDED" | "EXPIRED";
export class SaaSEntitlementError extends Error { constructor(public readonly code: "SUBSCRIPTION_DENIED" | "ENTITLEMENT_DENIED") { super(`SAAS_ENTITLEMENT_${code}`); } }

export function resolveSaaSAccess(input: Readonly<{ subscriptionStatus: SubscriptionStatus; subscriptionEndsAt?: Date | null; entitlementStatus?: EntitlementStatus; entitlementEndsAt?: Date | null; now?: Date }>): SaaSAccessState {
  const now = input.now ?? new Date();
  if (input.subscriptionStatus === SubscriptionStatus.SUSPENDED || input.entitlementStatus === EntitlementStatus.SUSPENDED) return "SUSPENDED";
  if (input.subscriptionStatus === SubscriptionStatus.EXPIRED || input.subscriptionStatus === SubscriptionStatus.CANCELLED || input.entitlementStatus === EntitlementStatus.EXPIRED || (input.subscriptionEndsAt && input.subscriptionEndsAt <= now) || (input.entitlementEndsAt && input.entitlementEndsAt <= now)) return "EXPIRED";
  return "ACTIVE";
}

export class SaaSEntitlementRepository {
  constructor(private readonly executor?: TenantBoundPrismaExecutor) {}
  private execute<T>(context: TenantContext, operation: (db: PrismaClient) => Promise<T>) { return (this.executor ?? requireTenantBoundPrismaExecutor()).execute(context, operation); }

  async getEffectiveEntitlement(context: TenantContext, key: string, now = new Date()) {
    const entitlement = await this.execute(context, (db) => db.organizationEntitlement.findFirst({ where: { organizationId: context.organizationId, key }, include: { subscription: { select: { status: true, endsAt: true } } } }));
    if (!entitlement) throw new SaaSEntitlementError("ENTITLEMENT_DENIED");
    return { key: entitlement.key, value: entitlement.value, state: resolveSaaSAccess({ subscriptionStatus: entitlement.subscription.status, subscriptionEndsAt: entitlement.subscription.endsAt, entitlementStatus: entitlement.status, entitlementEndsAt: entitlement.endsAt, now }) };
  }

  async listEffectiveEntitlements(context: TenantContext, now = new Date()) {
    const values = await this.execute(context, (db) => db.organizationEntitlement.findMany({ where: { organizationId: context.organizationId }, include: { subscription: { select: { status: true, endsAt: true } } }, orderBy: { key: "asc" } }));
    return values.map((entitlement) => ({ key: entitlement.key, value: entitlement.value, state: resolveSaaSAccess({ subscriptionStatus: entitlement.subscription.status, subscriptionEndsAt: entitlement.subscription.endsAt, entitlementStatus: entitlement.status, entitlementEndsAt: entitlement.endsAt, now }) }));
  }
}

export const saasEntitlementRepository = new SaaSEntitlementRepository();
