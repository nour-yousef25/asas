import type { PrismaClient } from "@prisma/client";
import { BrokerDeniedError, TenantAccessBroker, type BrokerContext, type TenantCredentialAuthority } from "@/lib/tenant-access-broker";

const context: BrokerContext = Object.freeze({
  userId: "user-a",
  organizationId: "org-a",
  membershipId: "membership-a",
  sessionVersion: 3,
  policySnapshotVersion: 7,
  correlationId: "corr-a",
});

function createFixture() {
  const events: Array<Record<string, unknown>> = [];
  const leases = new Map<string, Record<string, any>>();
  let principal: Record<string, any> = { id: "principal-a", organizationId: "org-a", principalName: "tenant_org_a", credentialReference: "external://tenant-org-a/g1", generation: 1, status: "ACTIVE" };
  let user = { isActive: true, authVersion: 3 };
  let membership: Record<string, unknown> | null = { policyVersion: 7 };
  const db = {
    user: { findUnique: jest.fn(async () => user) },
    organizationMembership: { findFirst: jest.fn(async () => membership) },
    tenantDatabasePrincipal: {
      findFirst: jest.fn(async () => principal.status === "ACTIVE" ? ({ id: principal.id, principalName: principal.principalName, credentialReference: principal.credentialReference, generation: principal.generation }) : null),
      update: jest.fn(async ({ data }: any) => { principal = { ...principal, ...data }; return principal; }),
    },
    tenantAccessLease: {
      create: jest.fn(async ({ data }: any) => { const row = { id: `lease-${leases.size + 1}`, ...data, status: "ACTIVE", issuedAt: new Date(), consumedAt: null, revokedAt: null, databasePrincipal: { id: principal.id, principalName: principal.principalName, credentialReference: principal.credentialReference, status: principal.status } }; leases.set(row.id, row); return row; }),
      findUnique: jest.fn(async ({ where }: any) => leases.get(where.id) ?? null),
      update: jest.fn(async ({ where, data }: any) => { const row = leases.get(where.id); if (!row) throw new Error("missing lease"); Object.assign(row, data); return row; }),
      updateMany: jest.fn(async ({ where, data }: any) => { let count = 0; for (const row of leases.values()) if (row.tenantDatabasePrincipalId === where.tenantDatabasePrincipalId && row.status === where.status) { Object.assign(row, data); count += 1; } return { count }; }),
    },
    tenantBrokerAuditEvent: { create: jest.fn(async ({ data }: any) => { events.push(data); return data; }) },
  } as unknown as PrismaClient;
  const authority: TenantCredentialAuthority = { run: jest.fn(async (input, operation) => operation({ principalName: input.principalName, correlationId: input.correlationId, connectionId: input.connectionId })) };
  let now = new Date("2026-08-23T00:00:00.000Z");
  const broker = new TenantAccessBroker(db, authority, 30_000, () => now);
  return { broker, authority, events, leases, setNow: (value: Date) => { now = value; }, setUser: (value: typeof user) => { user = value; }, setMembership: (value: Record<string, unknown> | null) => { membership = value; }, principal: () => principal };
}

describe("TenantAccessBroker lifecycle", () => {
  it("issues a tenant-specific descriptor without credential material and executes exactly once", async () => {
    const fixture = createFixture();
    const lease = await fixture.broker.issueLease(context);
    expect(lease).toMatchObject({ organizationId: "org-a", tenantDatabasePrincipalId: "principal-a", principalName: "tenant_org_a", correlationId: "corr-a" });
    expect(JSON.stringify(lease)).not.toMatch(/credential|password|secret/i);
    await expect(fixture.broker.execute(context, lease, async ({ principalName }) => principalName)).resolves.toBe("tenant_org_a");
    await expect(fixture.broker.execute(context, lease, async () => "replayed")).rejects.toMatchObject({ code: "LEASE_REPLAY" });
    expect(fixture.events.some((event) => event.reasonCode === "LEASE_EXECUTED" && event.correlationId === "corr-a")).toBe(true);
  });

  it("denies a lease presented with a different tenant context before authority access", async () => {
    const fixture = createFixture();
    const lease = await fixture.broker.issueLease(context);
    const foreign = { ...context, organizationId: "org-b", correlationId: "corr-a" };
    await expect(fixture.broker.execute(foreign, lease, async () => "forbidden")).rejects.toMatchObject({ code: "LEASE_CONTEXT_MISMATCH" });
    expect(fixture.authority.run).not.toHaveBeenCalled();
  });

  it("fails closed for stale session, stale policy, expired lease and revoked principal", async () => {
    const staleSession = createFixture();
    staleSession.setUser({ isActive: true, authVersion: 4 });
    await expect(staleSession.broker.issueLease(context)).rejects.toMatchObject({ code: "STALE_SESSION" });

    const stalePolicy = createFixture();
    stalePolicy.setMembership({ policyVersion: 8 });
    await expect(stalePolicy.broker.issueLease(context)).rejects.toMatchObject({ code: "STALE_POLICY" });

    const expired = createFixture();
    const expiredLease = await expired.broker.issueLease(context);
    expired.setNow(new Date("2026-08-23T00:01:00.000Z"));
    await expect(expired.broker.execute(context, expiredLease, async () => "expired")).rejects.toMatchObject({ code: "LEASE_EXPIRED" });

    const revoked = createFixture();
    const revokedLease = await revoked.broker.issueLease(context);
    await revoked.broker.revokePrincipal("principal-a", context.correlationId);
    await expect(revoked.broker.execute(context, revokedLease, async () => "revoked")).rejects.toMatchObject({ code: "LEASE_REVOKED" });
  });

  it("maps external authority uncertainty to a fail-closed denial without persisting secrets", async () => {
    const fixture = createFixture();
    const lease = await fixture.broker.issueLease(context);
    (fixture.authority.run as jest.Mock).mockRejectedValueOnce(new Error("authority unavailable"));
    await expect(fixture.broker.execute(context, lease, async () => "nope")).rejects.toMatchObject({ code: "AUTHORITY_OR_OPERATION_FAILURE" });
    expect(JSON.stringify(fixture.events)).not.toMatch(/external:\/\/tenant-org-a\/g1/);
  });
});
