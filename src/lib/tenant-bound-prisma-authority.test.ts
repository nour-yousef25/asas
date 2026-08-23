import type { PrismaClient } from "@prisma/client";
import { BrokerDeniedError, type BrokerContext, type TenantLeaseDescriptor } from "@/lib/tenant-access-broker";
import { TenantBoundPrismaCredentialAuthority, TenantBoundPrismaExecutor, type TenantConnectionProvider } from "@/lib/tenant-bound-prisma-authority";

const context: BrokerContext = Object.freeze({ userId: "user-a", organizationId: "org-a", membershipId: "membership-a", sessionVersion: 1, policySnapshotVersion: 1, correlationId: "corr-a" });
const descriptor: TenantLeaseDescriptor = Object.freeze({ leaseId: "lease-a", organizationId: "org-a", tenantDatabasePrincipalId: "principal-a", principalName: "tenant_a", connectionId: "connection-a", correlationId: "corr-a", expiresAt: new Date("2026-08-24T00:00:00.000Z") });

describe("TenantBoundPrismaConnectionAuthority", () => {
  it("passes only the checked-out tenant Prisma client to the operation and discards it afterwards", async () => {
    const tenantPrisma = { marker: "tenant-a" } as unknown as PrismaClient;
    const discard = jest.fn(async () => undefined);
    const provider: TenantConnectionProvider = { checkout: jest.fn(async (input) => { expect(input.principalName).toBe("tenant_a"); expect(input.credentialReference).toBe("opaque://tenant-a"); return { prisma: tenantPrisma, discard }; }) };
    const authority = new TenantBoundPrismaCredentialAuthority(provider);
    await expect(authority.run({ credentialReference: "opaque://tenant-a", principalName: "tenant_a", correlationId: "corr-a", connectionId: "connection-a" }, async (input) => input.prisma === tenantPrisma)).resolves.toBe(true);
    expect(discard).toHaveBeenCalledTimes(1);
  });

  it("discards a tenant connection when the database operation fails", async () => {
    const discard = jest.fn(async () => undefined);
    const provider: TenantConnectionProvider = { checkout: jest.fn(async () => ({ prisma: {} as PrismaClient, discard })) };
    const authority = new TenantBoundPrismaCredentialAuthority(provider);
    await expect(authority.run({ credentialReference: "opaque://tenant-a", principalName: "tenant_a", correlationId: "corr-a", connectionId: "connection-a" }, async () => { throw new Error("database failed"); })).rejects.toThrow("database failed");
    expect(discard).toHaveBeenCalledTimes(1);
  });

  it("requires the Broker to supply a tenant-bound Prisma client", async () => {
    const broker = { issueLease: jest.fn(async () => descriptor), execute: jest.fn(async (_context, _descriptor, operation) => operation({ principalName: "tenant_a", correlationId: "corr-a", connectionId: "connection-a" })) };
    const executor = new TenantBoundPrismaExecutor(broker);
    await expect(executor.execute(context, async () => "unexpected")).rejects.toMatchObject({ code: "TENANT_CONNECTION_AUTHORITY_UNAVAILABLE" });
  });

  it("cannot execute without a Broker-issued descriptor", async () => {
    const broker = { issueLease: jest.fn(async () => { throw new BrokerDeniedError("STALE_SESSION"); }), execute: jest.fn() };
    const executor = new TenantBoundPrismaExecutor(broker);
    await expect(executor.execute(context, async () => "unexpected")).rejects.toMatchObject({ code: "STALE_SESSION" });
    expect(broker.execute).not.toHaveBeenCalled();
  });
});
