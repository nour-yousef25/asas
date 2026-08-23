import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient, TenantAccessLeaseStatus, TenantDatabasePrincipalStatus } from "@prisma/client";
import type { TenantContext } from "@/lib/tenant-context";

export type BrokerContext = TenantContext & Readonly<{ sessionVersion: number }>;

export type TenantLeaseDescriptor = Readonly<{
  leaseId: string;
  organizationId: string;
  tenantDatabasePrincipalId: string;
  principalName: string;
  connectionId: string;
  correlationId: string;
  expiresAt: Date;
}>;

export type TenantDatabaseOperation<T> = (input: Readonly<{ principalName: string; correlationId: string; connectionId: string; prisma?: PrismaClient }>) => Promise<T>;

export interface TenantCredentialAuthority {
  run<T>(input: Readonly<{ credentialReference: string; principalName: string; correlationId: string; connectionId: string }>, operation: TenantDatabaseOperation<T>): Promise<T>;
}

export class BrokerDeniedError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "BrokerDeniedError";
  }
}

type PrincipalRecord = Readonly<{
  id: string;
  principalName: string;
  credentialReference: string;
  generation: number;
}>;

function fingerprint(context: BrokerContext) {
  return createHash("sha256")
    .update([context.userId, context.organizationId, context.membershipId, context.sessionVersion, context.policySnapshotVersion].join("|"))
    .digest("hex");
}

export class TenantAccessBroker {
  constructor(
    private readonly db: PrismaClient,
    private readonly authority: TenantCredentialAuthority,
    private readonly ttlMs = 60_000,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async audit(input: {
    context?: Partial<BrokerContext>;
    principalId?: string;
    leaseId?: string;
    decision: "ALLOW" | "DENY";
    reasonCode: string;
  }) {
    await this.db.tenantBrokerAuditEvent.create({
      data: {
        organizationId: input.context?.organizationId,
        membershipId: input.context?.membershipId,
        userId: input.context?.userId,
        tenantDatabasePrincipalId: input.principalId,
        leaseId: input.leaseId,
        correlationId: input.context?.correlationId ?? "missing-correlation",
        decision: input.decision,
        reasonCode: input.reasonCode,
        source: "tenant-access-broker",
      },
    });
  }

  private async validate(context: BrokerContext): Promise<PrincipalRecord> {
    if (!context?.userId || !context.organizationId || !context.membershipId || !context.correlationId) throw new BrokerDeniedError("CONTEXT_INVALID");
    const [user, membership] = await Promise.all([
      this.db.user.findUnique({ where: { id: context.userId }, select: { isActive: true, authVersion: true } }),
      this.db.organizationMembership.findFirst({
        where: { id: context.membershipId, userId: context.userId, organizationId: context.organizationId, isActive: true, revokedAt: null },
        select: { policyVersion: true },
      }),
    ]);
    if (!user?.isActive) throw new BrokerDeniedError("USER_REVOKED");
    if (user.authVersion !== context.sessionVersion) throw new BrokerDeniedError("STALE_SESSION");
    if (!membership) throw new BrokerDeniedError("MEMBERSHIP_ORGANIZATION_MISMATCH");
    if (membership.policyVersion !== context.policySnapshotVersion) throw new BrokerDeniedError("STALE_POLICY");
    const principal = await this.db.tenantDatabasePrincipal.findFirst({
      where: { organizationId: context.organizationId, status: "ACTIVE" },
      select: { id: true, principalName: true, credentialReference: true, generation: true },
    });
    if (!principal) throw new BrokerDeniedError("PRINCIPAL_MAPPING_ABSENT");
    return principal;
  }

  async issueLease(context: BrokerContext): Promise<TenantLeaseDescriptor> {
    try {
      const principal = await this.validate(context);
      const connectionId = randomUUID();
      const expiresAt = new Date(this.now().getTime() + this.ttlMs);
      const lease = await this.db.tenantAccessLease.create({
        data: {
          organizationId: context.organizationId,
          membershipId: context.membershipId,
          userId: context.userId,
          tenantDatabasePrincipalId: principal.id,
          correlationId: context.correlationId,
          connectionId,
          contextFingerprint: fingerprint(context),
          expiresAt,
        },
      });
      await this.audit({ context, principalId: principal.id, leaseId: lease.id, decision: "ALLOW", reasonCode: "LEASE_ISSUED" });
      return Object.freeze({ leaseId: lease.id, organizationId: context.organizationId, tenantDatabasePrincipalId: principal.id, principalName: principal.principalName, connectionId, correlationId: context.correlationId, expiresAt });
    } catch (error) {
      const reasonCode = error instanceof BrokerDeniedError ? error.code : "BROKER_EXCEPTION";
      await this.audit({ context, decision: "DENY", reasonCode });
      throw error instanceof BrokerDeniedError ? error : new BrokerDeniedError(reasonCode);
    }
  }

  async execute<T>(context: BrokerContext, descriptor: TenantLeaseDescriptor, operation: TenantDatabaseOperation<T>): Promise<T> {
    try {
      const lease = await this.db.tenantAccessLease.findUnique({
        where: { id: descriptor.leaseId },
        include: { databasePrincipal: { select: { id: true, principalName: true, credentialReference: true, status: true } } },
      });
      if (!lease) throw new BrokerDeniedError("LEASE_ABSENT");
      if (lease.status === "REVOKED" || lease.revokedAt) throw new BrokerDeniedError("LEASE_REVOKED");
      if (lease.status === "CONSUMED" || lease.consumedAt) throw new BrokerDeniedError("LEASE_REPLAY");
      if (lease.expiresAt <= this.now()) {
        await this.db.tenantAccessLease.update({ where: { id: lease.id }, data: { status: "EXPIRED" } });
        throw new BrokerDeniedError("LEASE_EXPIRED");
      }
      if (lease.connectionId !== descriptor.connectionId || lease.correlationId !== context.correlationId) throw new BrokerDeniedError("LEASE_CONNECTION_OR_CORRELATION_MISMATCH");
      if (lease.organizationId !== context.organizationId || lease.membershipId !== context.membershipId || lease.userId !== context.userId || lease.contextFingerprint !== fingerprint(context)) throw new BrokerDeniedError("LEASE_CONTEXT_MISMATCH");
      const principal = await this.validate(context);
      if (principal.id !== lease.tenantDatabasePrincipalId || principal.id !== descriptor.tenantDatabasePrincipalId || principal.principalName !== descriptor.principalName || lease.databasePrincipal.status !== "ACTIVE") throw new BrokerDeniedError("LEASE_PRINCIPAL_MAPPING_MISMATCH");
      const output = await this.authority.run({ credentialReference: principal.credentialReference, principalName: principal.principalName, correlationId: context.correlationId, connectionId: lease.connectionId }, operation);
      await this.db.tenantAccessLease.update({ where: { id: lease.id }, data: { status: "CONSUMED", consumedAt: this.now() } });
      await this.audit({ context, principalId: principal.id, leaseId: lease.id, decision: "ALLOW", reasonCode: "LEASE_EXECUTED" });
      return output;
    } catch (error) {
      const reasonCode = error instanceof BrokerDeniedError ? error.code : "AUTHORITY_OR_OPERATION_FAILURE";
      await this.audit({ context, principalId: descriptor.tenantDatabasePrincipalId, leaseId: descriptor.leaseId, decision: "DENY", reasonCode });
      throw error instanceof BrokerDeniedError ? error : new BrokerDeniedError(reasonCode);
    }
  }

  async revokeLease(leaseId: string, correlationId: string) {
    const lease = await this.db.tenantAccessLease.update({ where: { id: leaseId }, data: { status: "REVOKED", revokedAt: this.now() } });
    await this.audit({ context: { organizationId: lease.organizationId, membershipId: lease.membershipId, userId: lease.userId, correlationId }, principalId: lease.tenantDatabasePrincipalId, leaseId, decision: "ALLOW", reasonCode: "LEASE_REVOKED" });
  }

  async revokePrincipal(principalId: string, correlationId: string) {
    const principal = await this.db.tenantDatabasePrincipal.update({ where: { id: principalId }, data: { status: "REVOKED", revokedAt: this.now() } });
    await this.db.tenantAccessLease.updateMany({ where: { tenantDatabasePrincipalId: principalId, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: this.now() } });
    await this.audit({ context: { organizationId: principal.organizationId, correlationId }, principalId, decision: "ALLOW", reasonCode: "PRINCIPAL_REVOKED" });
  }
}

export const brokerStatus = {
  principalActive: "ACTIVE" as TenantDatabasePrincipalStatus,
  leaseActive: "ACTIVE" as TenantAccessLeaseStatus,
};
