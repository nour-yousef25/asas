/** W02 server bootstrap: control-plane Prisma plus fail-closed per-tenant checkout authority. */
import { prisma } from "@/lib/db";
import { TenantAccessBroker } from "@/lib/tenant-access-broker";
import { FileTenantConnectionProvider } from "@/lib/tenant-file-connection-provider";
import { installTenantBoundPrismaExecutor, TenantBoundPrismaCredentialAuthority, TenantBoundPrismaExecutor } from "@/lib/tenant-bound-prisma-authority";
import { installTenantArtifactProvider } from "@/lib/private-artifact";
import { FileTenantS3CredentialResolver, FileTenantStorageReferenceResolver, TenantS3ArtifactProvider } from "@/lib/tenant-s3-artifact-provider";

let bootstrapped = false;

function credentialReadGroupId(variable: string) {
  const value = process.env[variable];
  if (!value) return undefined;
  if (!/^(0|[1-9][0-9]{0,9})$/.test(value)) throw new Error(`${variable}_INVALID`);
  const id = Number(value);
  if (!Number.isSafeInteger(id)) throw new Error(`${variable}_INVALID`);
  return id;
}

function installTenantStorageRuntime() {
  const references = process.env.TENANT_STORAGE_REFERENCE_DIRECTORY;
  const credentials = process.env.TENANT_STORAGE_CREDENTIAL_DIRECTORY;
  if (!references && !credentials) return;
  if (!references || !credentials) throw new Error("TENANT_STORAGE_AUTHORITY_UNCONFIGURED");
  const allowedReadGroupId = credentialReadGroupId("TENANT_STORAGE_ALLOWED_GROUP_ID");
  installTenantArtifactProvider(new TenantS3ArtifactProvider(
    new FileTenantStorageReferenceResolver(references, allowedReadGroupId),
    new FileTenantS3CredentialResolver(credentials, allowedReadGroupId),
  ));
}

export function bootstrapTenantRuntime() {
  if (bootstrapped) return;
  const directory = process.env.TENANT_CREDENTIAL_DIRECTORY;
  if (!directory) throw new Error("TENANT_CONNECTION_AUTHORITY_UNCONFIGURED");
  const authority = new TenantBoundPrismaCredentialAuthority(new FileTenantConnectionProvider(directory, undefined, { allowedReadGroupId: credentialReadGroupId("TENANT_CREDENTIAL_ALLOWED_GROUP_ID") }));
  const broker = new TenantAccessBroker(prisma, authority);
  installTenantBoundPrismaExecutor(new TenantBoundPrismaExecutor(broker));
  installTenantStorageRuntime();
  bootstrapped = true;
}
