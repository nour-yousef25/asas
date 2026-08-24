import type { PrismaClient } from "@prisma/client";
import { ActivationStatus, IdentityProviderStatus, PrivacyRequestStatus, SecretRecordStatus } from "@prisma/client";
import type { TenantContext } from "@/lib/tenant-context";
import { requireTenantBoundPrismaExecutor, type TenantBoundPrismaExecutor } from "@/lib/tenant-bound-prisma-authority";
import { W02SecurityContractError, decidePrivacyAction, privacyRequestInputSchema } from "@/lib/w02-security-contracts";

/** W02 tenant data-plane repository. Never imports global Prisma or accepts a client-supplied organizationId. */
export class W02SecurityRepository {
  constructor(private readonly executor?: TenantBoundPrismaExecutor) {}
  private execute<T>(context: TenantContext, operation: (db: PrismaClient) => Promise<T>) {
    return (this.executor ?? requireTenantBoundPrismaExecutor()).execute(context, operation);
  }

  createSecretReference(context: TenantContext, input: { providerKey: string; purpose: string; opaqueReference: string; keyVersion: string }) {
    return this.execute(context, async (db) => {
      const existing = await db.secretRecord.findFirst({ where: { organizationId: context.organizationId, providerKey: input.providerKey, purpose: input.purpose, status: SecretRecordStatus.ACTIVE }, select: { id: true } });
      if (existing) throw new W02SecurityContractError("SECRET_REVOKED");
      return db.secretRecord.create({ data: { ...input, organizationId: context.organizationId, createdById: context.userId } });
    });
  }

  async revokeSecretReference(context: TenantContext, secretRecordId: string, purpose: string) {
    return this.execute(context, async (db) => {
      const update = await db.secretRecord.updateMany({ where: { id: secretRecordId, organizationId: context.organizationId, status: SecretRecordStatus.ACTIVE }, data: { status: SecretRecordStatus.REVOKED, revokedAt: new Date() } });
      if (update.count !== 1) throw new W02SecurityContractError("SECRET_REVOKED");
      return db.secretAccessAudit.create({ data: { organizationId: context.organizationId, secretRecordId, actorId: context.userId, action: "SECRET_REVOKED", purpose, outcome: "DENY_FUTURE_RESOLUTION", correlationId: context.correlationId } });
    });
  }

  upsertPrivacyPolicyBinding(context: TenantContext, input: { recordType: string; classification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED"; policyReference?: string; isApproved?: boolean }) {
    return this.execute(context, (db) => db.privacyPolicyBinding.upsert({ where: { organizationId_recordType: { organizationId: context.organizationId, recordType: input.recordType } }, create: { ...input, organizationId: context.organizationId, isApproved: input.isApproved ?? false }, update: { classification: input.classification, policyReference: input.policyReference, isApproved: input.isApproved ?? false } }));
  }

  async requestPrivacyAction(context: TenantContext, input: unknown) {
    const parsed = privacyRequestInputSchema.parse(input);
    return this.execute(context, async (db) => {
      const policy = await db.privacyPolicyBinding.findFirst({ where: { organizationId: context.organizationId, recordType: parsed.recordType, classification: parsed.classification }, select: { isApproved: true } });
      const decision = decidePrivacyAction({ policyApproved: Boolean(policy?.isApproved), legalHold: false });
      return db.privacyRequest.create({ data: { ...parsed, organizationId: context.organizationId, requesterId: context.userId, status: decision.code === "ALLOWED" ? PrivacyRequestStatus.REQUESTED : PrivacyRequestStatus.POLICY_REQUIRED } });
    });
  }

  async applyLegalHold(context: TenantContext, privacyRequestId: string) {
    return this.execute(context, async (db) => {
      const updated = await db.privacyRequest.updateMany({ where: { id: privacyRequestId, organizationId: context.organizationId, completedAt: null }, data: { legalHold: true, status: PrivacyRequestStatus.LEGAL_HOLD, decisionReason: "LEGAL_HOLD" } });
      if (updated.count !== 1) throw new W02SecurityContractError("LEGAL_HOLD");
      return db.privacyRequest.findFirst({ where: { id: privacyRequestId, organizationId: context.organizationId } });
    });
  }

  createActivation(context: TenantContext, input: { licenseKeyId: string; instanceId: string; certificateFingerprint: string; activationCodeHash: string; activationCodeSalt: string; expiresAt: Date }) {
    return this.execute(context, (db) => db.activationRecord.create({ data: { ...input, organizationId: context.organizationId, createdById: context.userId, correlationId: context.correlationId } }));
  }

  async recordActivationAttempt(context: TenantContext, activationId: string, activated: boolean, now = new Date()) {
    return this.execute(context, async (db) => {
      const record = await db.activationRecord.findFirst({ where: { id: activationId, organizationId: context.organizationId }, select: { id: true, status: true, expiresAt: true, consumedAt: true } });
      if (!record || record.status !== ActivationStatus.PENDING || record.consumedAt || record.expiresAt.getTime() <= now.getTime()) throw new W02SecurityContractError("ACTIVATION_DENIED");
      const nextStatus = activated ? ActivationStatus.ACTIVATED : ActivationStatus.PENDING;
      return db.activationRecord.update({ where: { id: record.id }, data: { attemptCount: { increment: 1 }, status: nextStatus, consumedAt: activated ? now : undefined } });
    });
  }

  async revokeActivation(context: TenantContext, activationId: string) {
    return this.execute(context, async (db) => {
      const result = await db.activationRecord.updateMany({ where: { id: activationId, organizationId: context.organizationId, status: { not: ActivationStatus.REVOKED } }, data: { status: ActivationStatus.REVOKED, revokedAt: new Date() } });
      if (result.count !== 1) throw new W02SecurityContractError("ACTIVATION_DENIED");
    });
  }

  registerIdentityProvider(context: TenantContext, input: { providerKey: string; environment: "SANDBOX" | "PRODUCTION"; clientSecretRefId?: string; issuerUri?: string; subjectClaim?: string }) {
    return this.execute(context, (db) => db.identityProviderConfig.upsert({ where: { organizationId_providerKey_environment: { organizationId: context.organizationId, providerKey: input.providerKey, environment: input.environment } }, create: { ...input, organizationId: context.organizationId, status: IdentityProviderStatus.DISABLED }, update: { clientSecretRefId: input.clientSecretRefId, issuerUri: input.issuerUri, subjectClaim: input.subjectClaim, status: IdentityProviderStatus.DISABLED } }));
  }

  async bindIdentitySubject(context: TenantContext, input: { configId: string; membershipId: string; subjectHash: string }) {
    return this.execute(context, async (db) => {
      const membership = await db.organizationMembership.findFirst({ where: { id: input.membershipId, organizationId: context.organizationId, isActive: true, revokedAt: null }, select: { id: true } });
      if (!membership) throw new W02SecurityContractError("IDP_CALLBACK_DENIED");
      return db.identitySubjectBinding.upsert({ where: { identityProviderConfigId_membershipId: { identityProviderConfigId: input.configId, membershipId: membership.id } }, create: { organizationId: context.organizationId, identityProviderConfigId: input.configId, membershipId: membership.id, subjectHash: input.subjectHash }, update: { subjectHash: input.subjectHash, isActive: true, revokedAt: null } });
    });
  }
}

export const w02SecurityRepository = new W02SecurityRepository();
