import { EntitlementStatus, SubscriptionStatus } from "@prisma/client";
import { resolveSaaSAccess } from "@/lib/saas-entitlements";

describe("SaaS entitlement lifecycle", () => {
  const now = new Date("2026-08-25T12:00:00.000Z");
  it("keeps payment-independent active, suspended and expired states fail-closed", () => {
    expect(resolveSaaSAccess({ subscriptionStatus: SubscriptionStatus.ACTIVE, entitlementStatus: EntitlementStatus.ACTIVE, now })).toBe("ACTIVE");
    expect(resolveSaaSAccess({ subscriptionStatus: SubscriptionStatus.SUSPENDED, entitlementStatus: EntitlementStatus.ACTIVE, now })).toBe("SUSPENDED");
    expect(resolveSaaSAccess({ subscriptionStatus: SubscriptionStatus.ACTIVE, entitlementStatus: EntitlementStatus.ACTIVE, entitlementEndsAt: new Date("2026-08-25T11:59:59.000Z"), now })).toBe("EXPIRED");
  });
});
