/** W02 server bootstrap: control-plane Prisma plus fail-closed per-tenant checkout authority. */
import { prisma } from "@/lib/db";
import { TenantAccessBroker } from "@/lib/tenant-access-broker";
import { FileTenantConnectionProvider } from "@/lib/tenant-file-connection-provider";
import { installTenantBoundPrismaExecutor, TenantBoundPrismaCredentialAuthority, TenantBoundPrismaExecutor } from "@/lib/tenant-bound-prisma-authority";

let bootstrapped = false;

export function bootstrapTenantRuntime() {
  if (bootstrapped) return;
  const directory = process.env.TENANT_CREDENTIAL_DIRECTORY;
  if (!directory) throw new Error("TENANT_CONNECTION_AUTHORITY_UNCONFIGURED");
  const authority = new TenantBoundPrismaCredentialAuthority(new FileTenantConnectionProvider(directory));
  const broker = new TenantAccessBroker(prisma, authority);
  installTenantBoundPrismaExecutor(new TenantBoundPrismaExecutor(broker));
  bootstrapped = true;
}
