import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { TenantContext } from "@/lib/tenant-context";
import { requirePermission } from "@/lib/policy";
import { requireTenantBoundPrismaExecutor, type TenantBoundPrismaExecutor } from "@/lib/tenant-bound-prisma-authority";

const PRIVATE_ARTIFACT_READ = "document.private.read";
const PRIVATE_ARTIFACT_UPLOAD = "document.private.upload";
const PRIVATE_ARTIFACT_MANAGE = "document.private.manage";
const DELIVERY_TTL_SECONDS = 300;

export class TenantArtifactBoundaryError extends Error {}

export type TenantArtifactProvider = Readonly<{
  put(input: Readonly<{ organizationId: string; artifactId: string; objectKey: string; data: Uint8Array; contentType: string }>): Promise<void>;
  delete(input: Readonly<{ organizationId: string; artifactId: string; objectKey: string }>): Promise<void>;
  issueDelivery(input: Readonly<{ organizationId: string; artifactId: string; objectKey: string; expiresInSeconds: number }>): Promise<Readonly<{ delivery: string; expiresAt: Date }>>;
}>;

let installedProvider: TenantArtifactProvider | undefined;

export function installTenantArtifactProvider(provider: TenantArtifactProvider) {
  if (installedProvider) throw new TenantArtifactBoundaryError("TENANT_ARTIFACT_PROVIDER_ALREADY_INSTALLED");
  installedProvider = provider;
}

export function requireTenantArtifactProvider() {
  if (!installedProvider) throw new TenantArtifactBoundaryError("TENANT_ARTIFACT_PROVIDER_UNCONFIGURED");
  return installedProvider;
}

function cleanName(name: string) {
  const value = name.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/[\\/]/g, "_").trim();
  if (!value || value.length > 180) throw new TenantArtifactBoundaryError("TENANT_ARTIFACT_NAME_INVALID");
  return value;
}

function objectKey(organizationId: string, artifactId: string, version: number) {
  return `private/${organizationId}/artifact/${artifactId}/v${version}`;
}

type CreateInput = Readonly<{ name: string; contentType: string; size: number; category?: string; beneficiaryId?: string; data: Uint8Array }>;

export class PrivateArtifactRepository {
  constructor(private readonly executor?: TenantBoundPrismaExecutor, private readonly provider?: TenantArtifactProvider) {}

  private execute<T>(context: TenantContext, operation: (db: PrismaClient) => Promise<T>) {
    return (this.executor ?? requireTenantBoundPrismaExecutor()).execute(context, operation);
  }

  private storage() { return this.provider ?? requireTenantArtifactProvider(); }

  private async audit(context: TenantContext, action: string, entityId: string, decision: "ALLOW" | "DENY", reasonCode: string) {
    await this.execute(context, (db) => db.auditLog.create({ data: { organizationId: context.organizationId, userId: context.userId, action, entity: "PrivateArtifact", entityId, details: { actorMembershipId: context.membershipId, decision, reasonCode, correlationId: context.correlationId, source: "private-artifact-repository" } } }));
  }

  async create(context: TenantContext, input: CreateInput) {
    await requirePermission(context, PRIVATE_ARTIFACT_UPLOAD);
    if (!Number.isInteger(input.size) || input.size < 1 || input.size !== input.data.byteLength || input.size > 10 * 1024 * 1024) throw new TenantArtifactBoundaryError("TENANT_ARTIFACT_SIZE_INVALID");
    if (!/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(input.contentType)) throw new TenantArtifactBoundaryError("TENANT_ARTIFACT_CONTENT_TYPE_INVALID");
    const name = cleanName(input.name);
    const artifactId = randomUUID();
    const key = objectKey(context.organizationId, artifactId, 1);
    const provider = this.storage();
    if (input.beneficiaryId) {
      const owned = await this.execute(context, (db) => db.beneficiary.findFirst({ where: { id: input.beneficiaryId, organizationId: context.organizationId }, select: { id: true } }));
      if (!owned) { await this.audit(context, "TENANT_ARTIFACT_CREATE_DENIED", input.beneficiaryId, "DENY", "BENEFICIARY_SCOPE"); throw new TenantArtifactBoundaryError("TENANT_ARTIFACT_OWNER_DENIED"); }
    }
    await provider.put({ organizationId: context.organizationId, artifactId, objectKey: key, data: input.data, contentType: input.contentType });
    try {
      const result = await this.execute(context, (db) => db.$transaction(async (tx) => {
        const document = await tx.document.create({ data: { organizationId: context.organizationId, name, fileUrl: `private-artifact://${artifactId}`, fileType: input.contentType, size: input.size, category: input.category, relatedEntity: input.beneficiaryId ? "Beneficiary" : "Organization", relatedId: input.beneficiaryId } });
        const artifact = await tx.privateArtifact.create({ data: { id: artifactId, organizationId: context.organizationId, documentId: document.id, objectKey: key, contentType: input.contentType, size: input.size, uploadedById: context.userId } });
        return { artifactId: artifact.id, documentId: document.id, name: document.name, contentType: artifact.contentType, size: artifact.size };
      }));
      await this.audit(context, "TENANT_ARTIFACT_CREATED", artifactId, "ALLOW", "OWNED_UPLOAD");
      return result;
    } catch (error) {
      await provider.delete({ organizationId: context.organizationId, artifactId, objectKey: key }).catch(() => undefined);
      throw error;
    }
  }

  async list(context: TenantContext) {
    await requirePermission(context, PRIVATE_ARTIFACT_READ);
    return this.execute(context, (db) => db.privateArtifact.findMany({ where: { organizationId: context.organizationId, state: "ACTIVE" }, select: { id: true, version: true, contentType: true, size: true, createdAt: true, document: { select: { id: true, name: true, category: true, relatedEntity: true, relatedId: true } } }, orderBy: { createdAt: "desc" } }));
  }

  private async owned(context: TenantContext, artifactId: string) {
    const artifact = await this.execute(context, (db) => db.privateArtifact.findFirst({ where: { id: artifactId, organizationId: context.organizationId, state: "ACTIVE" }, select: { id: true, organizationId: true, documentId: true, objectKey: true, version: true, contentType: true, size: true } }));
    if (!artifact) { await this.audit(context, "TENANT_ARTIFACT_ACCESS_DENIED", artifactId, "DENY", "ARTIFACT_SCOPE"); throw new TenantArtifactBoundaryError("TENANT_ARTIFACT_NOT_FOUND"); }
    return artifact;
  }

  async issueDownload(context: TenantContext, artifactId: string) {
    await requirePermission(context, PRIVATE_ARTIFACT_READ);
    const artifact = await this.owned(context, artifactId);
    const issued = await this.storage().issueDelivery({ organizationId: context.organizationId, artifactId: artifact.id, objectKey: artifact.objectKey, expiresInSeconds: DELIVERY_TTL_SECONDS });
    await this.audit(context, "TENANT_ARTIFACT_DELIVERY_ISSUED", artifact.id, "ALLOW", "OWNED_READ");
    return { artifactId: artifact.id, delivery: issued.delivery, expiresAt: issued.expiresAt };
  }

  async replace(context: TenantContext, artifactId: string, input: Readonly<{ contentType: string; size: number; data: Uint8Array }>) {
    await requirePermission(context, PRIVATE_ARTIFACT_MANAGE);
    const current = await this.owned(context, artifactId);
    if (!Number.isInteger(input.size) || input.size < 1 || input.size !== input.data.byteLength || input.size > 10 * 1024 * 1024) throw new TenantArtifactBoundaryError("TENANT_ARTIFACT_SIZE_INVALID");
    const nextVersion = current.version + 1;
    const nextKey = objectKey(context.organizationId, artifactId, nextVersion);
    const provider = this.storage();
    await provider.put({ organizationId: context.organizationId, artifactId, objectKey: nextKey, data: input.data, contentType: input.contentType });
    try {
      const replaced = await this.execute(context, (db) => db.$transaction(async (tx) => {
        await tx.document.update({ where: { id: current.documentId }, data: { fileType: input.contentType, size: input.size } });
        return tx.privateArtifact.update({ where: { id: artifactId }, data: { objectKey: nextKey, version: nextVersion, contentType: input.contentType, size: input.size } });
      }));
      await provider.delete({ organizationId: context.organizationId, artifactId, objectKey: current.objectKey });
      await this.audit(context, "TENANT_ARTIFACT_REPLACED", artifactId, "ALLOW", "OWNED_REPLACE");
      return { artifactId: replaced.id, version: replaced.version };
    } catch (error) {
      await provider.delete({ organizationId: context.organizationId, artifactId, objectKey: nextKey }).catch(() => undefined);
      throw error;
    }
  }

  async delete(context: TenantContext, artifactId: string) {
    await requirePermission(context, PRIVATE_ARTIFACT_MANAGE);
    const artifact = await this.owned(context, artifactId);
    await this.storage().delete({ organizationId: context.organizationId, artifactId, objectKey: artifact.objectKey });
    await this.execute(context, (db) => db.privateArtifact.update({ where: { id: artifact.id }, data: { state: "DELETED" } }));
    await this.audit(context, "TENANT_ARTIFACT_DELETED", artifact.id, "ALLOW", "OWNED_DELETE");
    return true;
  }
}

export const privateArtifactRepository = new PrivateArtifactRepository();
